import { Router, Response, NextFunction } from 'express';
import db from '../services/db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import PDFDocument from 'pdfkit';
import { stringify } from 'csv-stringify/sync';

const router = Router();

// GET /api/reports/impact/csv - export impact data as CSV
router.get('/impact/csv', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    let data: Record<string, unknown>[] = [];

    if (user.role === 'generator') {
      const generator = await db('generators').where({ user_id: user.id }).first();
      if (generator) {
        const listingIds = await db('waste_listings').where({ generator_id: generator.id }).pluck('id');
        const matchIds = listingIds.length > 0
          ? await db('matches').whereIn('listing_id', listingIds).pluck('id')
          : [];
        data = matchIds.length > 0
          ? await db('pickups')
            .whereIn('match_id', matchIds)
            .where({ status: 'verified' })
            .join('matches', 'pickups.match_id', 'matches.id')
            .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
            .join('facilities', 'matches.facility_id', 'facilities.id')
            .select(
              'pickups.id',
              'pickups.verified_at',
              'waste_listings.waste_type',
              'waste_listings.volume_t',
              'pickups.co2_sequestered_t',
              'pickups.distance_km',
              'facilities.name as facility_name',
              'facilities.conversion_type'
            )
          : [];
      }
    } else if (user.role === 'facility_operator') {
      const facility = await db('facilities').where({ user_id: user.id }).first();
      if (facility) {
        const matchIds = await db('matches').where({ facility_id: facility.id }).pluck('id');
        data = matchIds.length > 0
          ? await db('pickups')
            .whereIn('match_id', matchIds)
            .where({ status: 'verified' })
            .join('matches', 'pickups.match_id', 'matches.id')
            .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
            .join('generators', 'waste_listings.generator_id', 'generators.id')
            .select(
              'pickups.id',
              'pickups.verified_at',
              'waste_listings.waste_type',
              'waste_listings.volume_t',
              'pickups.co2_sequestered_t',
              'pickups.distance_km',
              'generators.site_name as generator_name'
            )
          : [];
      }
    }

    const csv = stringify(data, {
      header: true,
      columns: Object.keys(data[0] || {
        id: 'Pickup ID',
        verified_at: 'Verified At',
        waste_type: 'Waste Type',
        volume_t: 'Volume (tonnes)',
        co2_sequestered_t: 'CO2 Sequestered (tonnes)',
        distance_km: 'Distance (km)',
      }),
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="carbonloop-impact-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/impact/pdf - export impact report as PDF
router.get('/impact/pdf', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const profile = await db('profiles').where({ user_id: user.id }).first();
    const orgName = profile?.org_name || 'Organization';

    // Get impact data
    let totalCo2 = 0;
    let totalWaste = 0;
    let completedPickups = 0;
    let pickupData: Record<string, unknown>[] = [];

    if (user.role === 'generator') {
      const generator = await db('generators').where({ user_id: user.id }).first();
      if (generator) {
        const listingIds = await db('waste_listings').where({ generator_id: generator.id }).pluck('id');
        const matchIds = listingIds.length > 0
          ? await db('matches').whereIn('listing_id', listingIds).pluck('id')
          : [];
        if (matchIds.length > 0) {
          const co2 = await db('pickups').whereIn('match_id', matchIds).where({ status: 'verified' })
            .sum('co2_sequestered_t as total').first();
          const waste = await db('pickups').whereIn('match_id', matchIds).where({ status: 'verified' })
            .join('matches', 'pickups.match_id', 'matches.id')
            .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
            .sum('waste_listings.volume_t as volume').first();
          totalCo2 = parseFloat(co2?.total as string || '0');
          totalWaste = parseFloat(waste?.volume as string || '0');
          completedPickups = await db('pickups').whereIn('match_id', matchIds).where({ status: 'verified' }).count('* as count').then(r => parseInt(r[0]?.count as string || '0', 10));

          pickupData = await db('pickups').whereIn('match_id', matchIds).where({ status: 'verified' })
            .join('matches', 'pickups.match_id', 'matches.id')
            .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
            .join('facilities', 'matches.facility_id', 'facilities.id')
            .select('waste_listings.waste_type', 'waste_listings.volume_t', 'pickups.co2_sequestered_t', 'facilities.name as facility_name')
            .limit(20);
        }
      }
    }

    // Generate PDF
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="carbonloop-report-${Date.now()}.pdf"`);
    doc.pipe(res);

    // Header
    doc.rect(0, 0, doc.page.width, 80).fill('#166534');
    doc.fillColor('white').fontSize(24).font('Helvetica-Bold').text('CarbonLoop', 50, 25);
    doc.fontSize(12).font('Helvetica').text('Carbon Impact Report', 50, 52);

    doc.fillColor('#111827').moveDown(4);

    // Organization details
    doc.fontSize(16).font('Helvetica-Bold').text(orgName, { continued: false });
    doc.fontSize(11).font('Helvetica').fillColor('#6b7280')
      .text(`Report generated: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}`);

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#e5e7eb').stroke();
    doc.moveDown();

    // Summary boxes
    doc.fillColor('#111827').fontSize(14).font('Helvetica-Bold').text('Impact Summary');
    doc.moveDown(0.5);

    const boxY = doc.y;
    const boxW = (doc.page.width - 100 - 20) / 3;

    function summaryBox(x: number, y: number, label: string, value: string, unit: string) {
      doc.rect(x, y, boxW, 70).fill('#f0fdf4').stroke('#bbf7d0');
      doc.fillColor('#166534').fontSize(20).font('Helvetica-Bold').text(value, x + 10, y + 12, { width: boxW - 20, align: 'center' });
      doc.fillColor('#6b7280').fontSize(9).font('Helvetica').text(unit, x + 10, y + 38, { width: boxW - 20, align: 'center' });
      doc.fillColor('#111827').fontSize(10).font('Helvetica').text(label, x + 10, y + 52, { width: boxW - 20, align: 'center' });
    }

    summaryBox(50, boxY, 'CO2 Sequestered', totalCo2.toFixed(2), 'tonnes CO2e');
    summaryBox(50 + boxW + 10, boxY, 'Waste Diverted', totalWaste.toFixed(2), 'tonnes');
    summaryBox(50 + (boxW + 10) * 2, boxY, 'Completed Pickups', completedPickups.toString(), 'verified deliveries');

    doc.y = boxY + 90;
    doc.moveDown();

    // Methodology note
    doc.fontSize(10).font('Helvetica-Oblique').fillColor('#6b7280')
      .text('Methodology: Carbon sequestration calculated per EPA WARM v15 and IPCC AR6 WG3 emission factors. Transport penalties applied using UK DEFRA 2023 HGV factors (0.062 kg CO2e per tonne-km).');

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#e5e7eb').stroke();
    doc.moveDown();

    // Pickup table
    if (pickupData.length > 0) {
      doc.fillColor('#111827').fontSize(14).font('Helvetica-Bold').text('Pickup Details');
      doc.moveDown(0.5);

      const colWidths = [150, 80, 100, 120];
      const headers = ['Facility', 'Waste Type', 'Volume (t)', 'CO2 Sequestered (t)'];
      let rowY = doc.y;

      doc.rect(50, rowY, doc.page.width - 100, 20).fill('#f0fdf4');
      headers.forEach((h, i) => {
        const x = 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.fillColor('#166534').fontSize(9).font('Helvetica-Bold').text(h, x + 4, rowY + 5, { width: colWidths[i] });
      });
      rowY += 22;

      for (const row of pickupData) {
        const values = [
          (row.facility_name as string) || '',
          ((row.waste_type as string) || '').replace(/_/g, ' '),
          parseFloat(row.volume_t as string || '0').toFixed(2),
          parseFloat(row.co2_sequestered_t as string || '0').toFixed(3),
        ];
        doc.rect(50, rowY, doc.page.width - 100, 18).fill(pickupData.indexOf(row) % 2 === 0 ? '#fff' : '#f9fafb').stroke('#f3f4f6');
        values.forEach((v, i) => {
          const x = 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
          doc.fillColor('#374151').fontSize(9).font('Helvetica').text(v, x + 4, rowY + 4, { width: colWidths[i] });
        });
        rowY += 20;
        if (rowY > doc.page.height - 80) {
          doc.addPage();
          rowY = 50;
        }
      }
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).fillColor('#9ca3af').font('Helvetica')
      .text('CarbonLoop. Building a circular carbon economy. Data sourced from verified platform pickups only.', { align: 'center' });

    doc.end();
  } catch (err) {
    next(err);
  }
});

export default router;

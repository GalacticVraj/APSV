import { Router, Response, NextFunction } from 'express';
import db from '../services/db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import PDFDocument from 'pdfkit';
import { stringify } from 'csv-stringify/sync';

const router = Router();

// ─── Shared economic constants ───────────────────────────────────────────────
const SHADOW_PRICE_AVOIDED_INR = 520;
const SHADOW_PRICE_DURABLE_INR = 10800;
const TRANSPORT_COST_INR_PER_TONNE_KM = 12;
const LCOP_BY_TYPE: Record<string, number> = {
  biochar_pyrolysis: 3200, anaerobic_digestion: 2800,
  aerobic_composting: 1200, vermicomposting: 900,
};
const CONVERSION_LABELS: Record<string, string> = {
  biochar_pyrolysis: 'Biochar Pyrolysis', anaerobic_digestion: 'Anaerobic Digestion',
  aerobic_composting: 'Aerobic Composting', vermicomposting: 'Vermicomposting',
};
function shadowPrice(ct: string) { return ct === 'biochar_pyrolysis' ? SHADOW_PRICE_DURABLE_INR : SHADOW_PRICE_AVOIDED_INR; }
function fmtDate(d: Date | string | null | undefined) {
  if (!d) return 'N/A';
  return new Date(d as string).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtINR(n: number) { return `₹${n.toLocaleString('en-IN')}`; }

// ─── Helper: draw PDF page footer ────────────────────────────────────────────
function addPdfFooters(doc: InstanceType<typeof PDFDocument>, reportTitle: string, timestamp: string) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    const y = doc.page.height - 35;
    doc.moveTo(50, y - 6).lineTo(doc.page.width - 50, y - 6).strokeColor('#166534').lineWidth(0.5).stroke();
    doc.fillColor('#9ca3af').fontSize(7.5).font('Helvetica')
      .text(reportTitle, 50, y, { width: 250, align: 'left', lineBreak: false });
    doc.text(`Page ${i + 1} of ${total}`, 0, y, { width: doc.page.width - 50, align: 'center', lineBreak: false });
    doc.text(`Generated: ${timestamp}`, 50, y, { width: doc.page.width - 100, align: 'right', lineBreak: false });
  }
}

// ─── Helper: draw PDF cover page ─────────────────────────────────────────────
function drawCover(
  doc: InstanceType<typeof PDFDocument>,
  title: string,
  subtitle: string,
  dateRange: string,
  filters: string,
  timestamp: string
) {
  // Green header band
  doc.rect(0, 0, doc.page.width, 110).fill('#166534');
  doc.fillColor('white').fontSize(10).font('Helvetica').text('CarbonLoop', 50, 28);
  doc.fontSize(22).font('Helvetica-Bold').text(title, 50, 44);
  doc.fontSize(11).font('Helvetica').text(subtitle, 50, 74);

  doc.fillColor('#111827').fontSize(11).font('Helvetica').moveDown(6);
  doc.moveTo(50, 140).lineTo(doc.page.width - 50, 140).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#374151').text('Report Parameters', 50, 152);
  doc.moveDown(0.3);
  doc.fontSize(9.5).font('Helvetica').fillColor('#6b7280');
  doc.text(`Date range:  ${dateRange}`, 50);
  doc.text(`Filters:     ${filters || 'None applied'}`, 50);
  doc.text(`Generated:   ${timestamp}`, 50);
  doc.moveDown(1.5);
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
}

// ─── Helper: KPI summary table in PDF ────────────────────────────────────────
function drawKpiTable(
  doc: InstanceType<typeof PDFDocument>,
  kpis: { label: string; value: string; unit: string }[]
) {
  const cols = Math.min(kpis.length, 3);
  const boxW = (doc.page.width - 100 - (cols - 1) * 10) / cols;
  const startY = doc.y + 8;

  kpis.slice(0, 6).forEach((kpi, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = 50 + col * (boxW + 10);
    const y = startY + row * 80;
    doc.rect(x, y, boxW, 68).fill('#f0fdf4').stroke('#bbf7d0');
    doc.fillColor('#166534').fontSize(16).font('Helvetica-Bold')
      .text(kpi.value, x + 8, y + 10, { width: boxW - 16, align: 'center' });
    doc.fillColor('#4b5563').fontSize(8).font('Helvetica')
      .text(kpi.unit, x + 8, y + 34, { width: boxW - 16, align: 'center' });
    doc.fillColor('#111827').fontSize(9).font('Helvetica-Bold')
      .text(kpi.label, x + 8, y + 48, { width: boxW - 16, align: 'center' });
  });

  const rows = Math.ceil(kpis.length / cols);
  doc.y = startY + rows * 80 + 12;
}

// ─── Helper: data table in PDF ───────────────────────────────────────────────
function drawDataTable(
  doc: InstanceType<typeof PDFDocument>,
  headers: string[],
  rows: string[][],
  colWidths: number[]
) {
  const startX = 50;
  let y = doc.y + 6;
  const rowH = 18;
  const hdrH = 22;

  // Header row
  doc.rect(startX, y, doc.page.width - 100, hdrH).fill('#f0fdf4');
  headers.forEach((h, i) => {
    const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.fillColor('#166534').fontSize(8).font('Helvetica-Bold')
      .text(h, x + 4, y + 6, { width: colWidths[i] - 4 });
  });
  y += hdrH;

  rows.forEach((row, ri) => {
    if (y > doc.page.height - 60) {
      doc.addPage();
      y = 50;
    }
    const bg = ri % 2 === 0 ? '#ffffff' : '#f9fafb';
    doc.rect(startX, y, doc.page.width - 100, rowH).fill(bg).stroke('#f3f4f6');
    row.forEach((cell, ci) => {
      const x = startX + colWidths.slice(0, ci).reduce((a, b) => a + b, 0);
      doc.fillColor('#374151').fontSize(8).font('Helvetica')
        .text(String(cell).slice(0, 40), x + 4, y + 4, { width: colWidths[ci] - 6 });
    });
    y += rowH;
  });
  doc.y = y + 8;
}

// ─── Helper: methodology section ─────────────────────────────────────────────
function drawMethodology(doc: InstanceType<typeof PDFDocument>) {
  if (doc.y > doc.page.height - 150) doc.addPage();
  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#166534').lineWidth(0.5).stroke();
  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#166534').text('Methodology & Model References');
  doc.moveDown(0.4);
  doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563');
  const notes = [
    'Carbon Sequestration: EPA WARM v15 emission factors; biogenic CO₂ excluded per IPCC AR6 WG3 §12.3 (combustion of biomass carbon returns to atmosphere in same growing season).',
    'Durable Removal (Biochar): Two-pool first-order decay parameterised by H/Cₒᵣg ratio; Q10-corrected from 14.9 °C reference to local soil temperature. Shadow price ₹10,800/tCO₂e. Durable removal and avoided emissions are reported separately and never summed.',
    'Avoided Emissions: CH₄ and N₂O avoided only. Shadow price ₹520/tCO₂e.',
    'Transport Emissions: DEFRA 2023 HGV factors (0.062 kg CO₂e/tonne-km). Transport cost: ₹12/tonne-km estimate.',
    'Levelised Cost of Processing (LCOP): Pathway-specific estimates — Biochar Pyrolysis ₹3,200/t; Anaerobic Digestion ₹2,800/t; Aerobic Composting ₹1,200/t; Vermicomposting ₹900/t.',
    'DCF Analysis: 5-year NPV at 10% nominal discount rate (factor 3.791). All figures are indicative; actual returns depend on market conditions.',
    'Marginal Abatement Cost Curve (MACC): Pathways ranked by net margin per tonne CO₂e sequestered. Break-even distance: carbon shadow value per tonne ÷ transport cost per tonne-km.',
  ];
  notes.forEach(note => {
    doc.text(`• ${note}`, { indent: 10 });
    doc.moveDown(0.3);
  });
}

// ─── Scope helper ────────────────────────────────────────────────────────────
async function applyScope(q: ReturnType<typeof db>, user: AuthenticatedRequest['user']) {
  if (!user) return q;
  if (user.role === 'generator') {
    const gen = await db('generators').where({ user_id: user.id }).first();
    if (gen) q = q.where('waste_listings.generator_id', gen.id);
  } else if (user.role === 'facility_operator') {
    const fac = await db('facilities').where({ user_id: user.id }).first();
    if (fac) q = q.where('matches.facility_id', fac.id);
  }
  return q;
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXISTING ENDPOINTS (preserved)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/reports/impact/csv
router.get('/impact/csv', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    let data: Record<string, unknown>[] = [];

    if (user.role === 'generator') {
      const generator = await db('generators').where({ user_id: user.id }).first();
      if (generator) {
        const listingIds = await db('waste_listings').where({ generator_id: generator.id }).pluck('id');
        const matchIds = listingIds.length > 0
          ? await db('matches').whereIn('listing_id', listingIds).pluck('id') : [];
        data = matchIds.length > 0
          ? await db('pickups').whereIn('match_id', matchIds).where({ status: 'verified' })
            .join('matches', 'pickups.match_id', 'matches.id')
            .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
            .join('facilities', 'matches.facility_id', 'facilities.id')
            .select('pickups.id', 'pickups.verified_at', 'waste_listings.waste_type',
              'waste_listings.volume_t', 'pickups.co2_sequestered_t', 'pickups.distance_km',
              'facilities.name as facility_name', 'facilities.conversion_type')
          : [];
      }
    } else if (user.role === 'facility_operator') {
      const facility = await db('facilities').where({ user_id: user.id }).first();
      if (facility) {
        const matchIds = await db('matches').where({ facility_id: facility.id }).pluck('id');
        data = matchIds.length > 0
          ? await db('pickups').whereIn('match_id', matchIds).where({ status: 'verified' })
            .join('matches', 'pickups.match_id', 'matches.id')
            .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
            .join('generators', 'waste_listings.generator_id', 'generators.id')
            .select('pickups.id', 'pickups.verified_at', 'waste_listings.waste_type',
              'waste_listings.volume_t', 'pickups.co2_sequestered_t', 'pickups.distance_km',
              'generators.site_name as generator_name')
          : [];
      }
    }

    const csv = stringify(data, {
      header: true,
      columns: Object.keys(data[0] || {
        id: 'Pickup ID', verified_at: 'Verified At', waste_type: 'Waste Type',
        volume_t: 'Volume (tonnes)', co2_sequestered_t: 'CO2 Sequestered (tonnes)',
        distance_km: 'Distance (km)',
      }),
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="carbonloop-impact-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// GET /api/reports/impact/pdf
router.get('/impact/pdf', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const profile = await db('profiles').where({ user_id: user.id }).first();
    const orgName = profile?.org_name || 'Organization';
    let totalCo2 = 0, totalWaste = 0, completedPickups = 0;
    let pickupData: Record<string, unknown>[] = [];

    if (user.role === 'generator') {
      const generator = await db('generators').where({ user_id: user.id }).first();
      if (generator) {
        const listingIds = await db('waste_listings').where({ generator_id: generator.id }).pluck('id');
        const matchIds = listingIds.length > 0 ? await db('matches').whereIn('listing_id', listingIds).pluck('id') : [];
        if (matchIds.length > 0) {
          const co2  = await db('pickups').whereIn('match_id', matchIds).where({ status: 'verified' }).sum('co2_sequestered_t as total').first();
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
            .select('waste_listings.waste_type', 'waste_listings.volume_t', 'pickups.co2_sequestered_t', 'facilities.name as facility_name').limit(20);
        }
      }
    }

    const doc = new PDFDocument({ margin: 50, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="carbonloop-impact-report-${Date.now()}.pdf"`);
    doc.pipe(res);

    doc.rect(0, 0, doc.page.width, 80).fill('#166534');
    doc.fillColor('white').fontSize(24).font('Helvetica-Bold').text('CarbonLoop', 50, 25);
    doc.fontSize(12).font('Helvetica').text('Carbon Impact Report', 50, 52);
    doc.fillColor('#111827').moveDown(4);
    doc.fontSize(16).font('Helvetica-Bold').text(orgName);
    doc.fontSize(11).font('Helvetica').fillColor('#6b7280')
      .text(`Generated: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}`);
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#e5e7eb').stroke();
    doc.moveDown();

    doc.fillColor('#111827').fontSize(14).font('Helvetica-Bold').text('Impact Summary');
    doc.moveDown(0.5);
    drawKpiTable(doc, [
      { label: 'CO2 Sequestered', value: totalCo2.toFixed(2), unit: 'tonnes CO2e' },
      { label: 'Waste Diverted', value: totalWaste.toFixed(2), unit: 'tonnes' },
      { label: 'Completed Pickups', value: completedPickups.toString(), unit: 'verified deliveries' },
    ]);

    doc.fontSize(10).font('Helvetica-Oblique').fillColor('#6b7280')
      .text('Methodology: Carbon sequestration per EPA WARM v15 and IPCC AR6 WG3. Transport penalties per DEFRA 2023 HGV factors.');
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#e5e7eb').stroke();
    doc.moveDown();

    if (pickupData.length > 0) {
      doc.fillColor('#111827').fontSize(14).font('Helvetica-Bold').text('Pickup Details');
      doc.moveDown(0.5);
      drawDataTable(doc,
        ['Facility', 'Waste Type', 'Volume (t)', 'CO2 (t)'],
        pickupData.map(r => [
          String(r.facility_name || ''), String(r.waste_type || '').replace(/_/g, ' '),
          parseFloat(String(r.volume_t || 0)).toFixed(2),
          parseFloat(String(r.co2_sequestered_t || 0)).toFixed(3),
        ]),
        [150, 130, 90, 100]
      );
    }

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#9ca3af').font('Helvetica')
      .text('CarbonLoop. Building a circular carbon economy. Data sourced from verified platform pickups only.', { align: 'center' });

    addPdfFooters(doc, 'Carbon Impact Report', new Date().toISOString());
    doc.end();
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  ECONOMICS CSV EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/reports/economics/trade-ledger/csv
router.get('/economics/trade-ledger/csv', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { dateStart, dateEnd, wasteType } = req.query;
    const user = req.user!;

    let q = db('pickups')
      .join('matches',       'pickups.match_id',            'matches.id')
      .join('waste_listings','matches.listing_id',           'waste_listings.id')
      .join('generators',    'waste_listings.generator_id', 'generators.id')
      .join('profiles',      'generators.user_id',          'profiles.user_id')
      .join('facilities',    'matches.facility_id',          'facilities.id')
      .where('pickups.status', 'verified');

    if (dateStart) q = q.where('pickups.verified_at', '>=', new Date(dateStart as string));
    if (dateEnd)   q = q.where('pickups.verified_at', '<=', new Date(dateEnd as string));
    if (wasteType) q = q.where('waste_listings.waste_type', wasteType as string);
    q = await applyScope(q, user);

    const rows = await q
      .select(
        'pickups.id as pickup_id',
        db.raw("TO_CHAR(pickups.verified_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') as verified_at_iso"),
        'waste_listings.waste_type',
        'waste_listings.volume_t',
        'pickups.co2_sequestered_t',
        'pickups.distance_km',
        db.raw("profiles.org_name as generator_name"),
        db.raw("generators.city as generator_city"),
        db.raw("facilities.name as facility_name"),
        db.raw("facilities.city as facility_city"),
        'facilities.conversion_type'
      )
      .orderBy('pickups.verified_at', 'desc');

    const csvData = rows.map((r: Record<string, unknown>) => ({
      pickup_id:         r.pickup_id,
      verified_at_iso:   r.verified_at_iso,
      waste_type:        r.waste_type,
      volume_t:          parseFloat(String(r.volume_t || 0)),
      co2_sequestered_t: parseFloat(String(r.co2_sequestered_t || 0)),
      distance_km:       parseFloat(String(r.distance_km || 0)),
      generator_name:    r.generator_name,
      generator_city:    r.generator_city,
      facility_name:     r.facility_name,
      facility_city:     r.facility_city,
      conversion_type:   r.conversion_type,
    }));

    const csv = stringify(csvData, {
      header: true,
      columns: {
        pickup_id: 'Pickup ID', verified_at_iso: 'Verified At (ISO)',
        waste_type: 'Waste Type', volume_t: 'Volume (tonnes)',
        co2_sequestered_t: 'CO2 Sequestered (tonnes)', distance_km: 'Distance (km)',
        generator_name: 'Generator', generator_city: 'Generator City',
        facility_name: 'Facility', facility_city: 'Facility City',
        conversion_type: 'Conversion Pathway',
      },
    });

    const ds = dateStart ? String(dateStart).slice(0, 10) : 'all';
    const de = dateEnd   ? String(dateEnd).slice(0, 10)   : 'all';
    const wt = wasteType ? `-${wasteType}` : '';
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="carbonloop-trade-ledger-${ds}-to-${de}${wt}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// GET /api/reports/economics/pathway-economics/csv
router.get('/economics/pathway-economics/csv', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { dateStart, dateEnd } = req.query;
    const user = req.user!;

    let q = db('pickups')
      .join('matches',       'pickups.match_id',    'matches.id')
      .join('waste_listings','matches.listing_id',   'waste_listings.id')
      .join('facilities',    'matches.facility_id', 'facilities.id')
      .where('pickups.status', 'verified')
      .select('facilities.conversion_type')
      .count('pickups.id as pickup_count')
      .sum('waste_listings.volume_t as total_volume_t')
      .sum('pickups.co2_sequestered_t as total_co2_t')
      .avg('pickups.distance_km as avg_distance_km')
      .groupBy('facilities.conversion_type');

    if (dateStart) q = q.where('pickups.verified_at', '>=', new Date(dateStart as string));
    if (dateEnd)   q = q.where('pickups.verified_at', '<=', new Date(dateEnd as string));
    q = await applyScope(q, user);
    const rows = await q;

    const csvData = rows.map((r: Record<string, unknown>) => {
      const ct       = String(r.conversion_type);
      const totalCo2 = parseFloat(String(r.total_co2_t || 0));
      const totalVol = parseFloat(String(r.total_volume_t || 0));
      const price    = shadowPrice(ct);
      const lcop     = LCOP_BY_TYPE[ct] || 1500;
      return {
        conversion_pathway:      CONVERSION_LABELS[ct] || ct,
        pickup_count:            parseInt(String(r.pickup_count || 0), 10),
        total_volume_t:          totalVol.toFixed(2),
        total_co2_sequestered_t: totalCo2.toFixed(3),
        avg_co2_per_tonne:       totalVol > 0 ? (totalCo2 / totalVol).toFixed(4) : '0',
        avg_distance_km:         parseFloat(String(r.avg_distance_km || 0)).toFixed(1),
        lcop_inr_per_tonne:      lcop,
        shadow_price_inr_per_tco2: price,
        gross_carbon_value_inr:  Math.round(totalCo2 * price),
        net_margin_inr:          Math.round(totalCo2 * price - totalVol * lcop),
      };
    });

    const csv = stringify(csvData, {
      header: true,
      columns: {
        conversion_pathway: 'Conversion Pathway', pickup_count: 'Pickup Count',
        total_volume_t: 'Total Volume (t)', total_co2_sequestered_t: 'Total CO2 Sequestered (t)',
        avg_co2_per_tonne: 'Avg CO2/Tonne', avg_distance_km: 'Avg Distance (km)',
        lcop_inr_per_tonne: 'LCOP (INR/t)', shadow_price_inr_per_tco2: 'Shadow Price (INR/tCO2)',
        gross_carbon_value_inr: 'Gross Carbon Value (INR)', net_margin_inr: 'Net Margin (INR)',
      },
    });

    const ds = dateStart ? String(dateStart).slice(0, 10) : 'all';
    const de = dateEnd   ? String(dateEnd).slice(0, 10)   : 'all';
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="carbonloop-pathway-economics-${ds}-to-${de}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// GET /api/reports/economics/investment-opportunities/csv
router.get('/economics/investment-opportunities/csv', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    let facQ = db('facilities').select('*');
    if (user.role === 'facility_operator') facQ = facQ.where({ user_id: user.id });
    const facilities = await facQ;

    const facilityStats = await db('pickups')
      .join('matches',       'pickups.match_id',   'matches.id')
      .join('waste_listings','matches.listing_id',  'waste_listings.id')
      .where('pickups.status', 'verified')
      .select('matches.facility_id')
      .avg('pickups.co2_sequestered_t as avg_co2')
      .avg('waste_listings.volume_t as avg_volume')
      .count('pickups.id as pickup_count')
      .groupBy('matches.facility_id');

    const statsMap = new Map(facilityStats.map((s: Record<string, unknown>) => [String(s.facility_id), s]));

    const csvData = facilities.map((fac: Record<string, unknown>) => {
      const stats        = statsMap.get(String(fac.id)) as Record<string, unknown> | undefined;
      const avgCo2Pick   = parseFloat(String(stats?.avg_co2   || 0));
      const avgVolPick   = parseFloat(String(stats?.avg_volume || 1));
      const avgCo2PerT   = avgVolPick > 0 ? avgCo2Pick / avgVolPick : 0;
      const remaining    = parseFloat(String(fac.remaining_capacity_t || 0));
      const capMonth     = parseFloat(String(fac.capacity_t_month     || 1));
      const price        = shadowPrice(String(fac.conversion_type));
      const lcop         = LCOP_BY_TYPE[String(fac.conversion_type)] || 1500;
      const annualShadow = remaining * 12 * avgCo2PerT * price;
      const annualNet    = annualShadow - remaining * 12 * lcop;
      const breakEven    = avgCo2PerT > 0 ? price * avgCo2PerT / TRANSPORT_COST_INR_PER_TONNE_KM : 0;
      return {
        facility_name:              fac.name,
        city:                       fac.city,
        conversion_pathway:         CONVERSION_LABELS[String(fac.conversion_type)] || fac.conversion_type,
        capacity_t_month:           capMonth.toFixed(0),
        remaining_capacity_t:       remaining.toFixed(1),
        headroom_pct:               capMonth > 0 ? Math.round((remaining / capMonth) * 100) : 0,
        avg_co2_per_tonne:          avgCo2PerT.toFixed(4),
        shadow_price_inr_per_tco2:  price,
        lcop_inr_per_tonne:         lcop,
        annual_shadow_value_inr:    Math.round(annualShadow),
        annual_net_value_inr:       Math.round(annualNet),
        break_even_distance_km:     breakEven.toFixed(1),
        dcf_5y_inr:                 Math.round(Math.max(0, annualNet) * 3.791),
        historical_pickups:         parseInt(String(stats?.pickup_count || 0), 10),
      };
    });
    csvData.sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b.dcf_5y_inr as number) - (a.dcf_5y_inr as number));

    const csv = stringify(csvData, {
      header: true,
      columns: {
        facility_name: 'Facility', city: 'City', conversion_pathway: 'Conversion Pathway',
        capacity_t_month: 'Capacity (t/month)', remaining_capacity_t: 'Remaining Capacity (t)',
        headroom_pct: 'Headroom (%)', avg_co2_per_tonne: 'Avg CO2/Tonne',
        shadow_price_inr_per_tco2: 'Shadow Price (INR/tCO2)', lcop_inr_per_tonne: 'LCOP (INR/t)',
        annual_shadow_value_inr: 'Annual Shadow Value (INR)', annual_net_value_inr: 'Annual Net Value (INR)',
        break_even_distance_km: 'Break-Even Distance (km)', dcf_5y_inr: '5Y DCF (INR)',
        historical_pickups: 'Historical Pickups',
      },
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="carbonloop-investment-opportunities-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  ECONOMICS PDF REPORTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/reports/economics/view-report/pdf?view=overview|trade-ledger|pathway-economics|investment-opportunities
router.get('/economics/view-report/pdf', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { view = 'overview', dateStart, dateEnd, wasteType } = req.query;
    const user = req.user!;
    const timestamp = new Date().toISOString();
    const ds = dateStart ? fmtDate(dateStart as string) : 'All time';
    const de = dateEnd   ? fmtDate(dateEnd   as string) : 'Present';
    const dateRange = `${ds} → ${de}`;
    const filterStr = wasteType ? `Waste type: ${String(wasteType).replace(/_/g, ' ')}` : '';

    const viewLabels: Record<string, string> = {
      'overview':                'Economic Overview',
      'trade-ledger':            'Trade Ledger',
      'pathway-economics':       'Pathway Economics',
      'investment-opportunities':'Investment Opportunities',
    };
    const viewLabel = viewLabels[String(view)] || 'Economics Report';

    const doc = new PDFDocument({ margin: 50, bufferPages: true });
    const safeView = String(view).replace(/[^a-z-]/g, '');
    const ds2 = dateStart ? String(dateStart).slice(0, 10) : 'all';
    const de2 = dateEnd   ? String(dateEnd).slice(0, 10)   : 'all';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="carbonloop-${safeView}-${ds2}-to-${de2}.pdf"`);
    doc.pipe(res);

    // COVER
    drawCover(doc, `CarbonLoop — ${viewLabel}`, 'Economic Analysis Report', dateRange, filterStr, timestamp);
    doc.addPage();

    if (view === 'overview' || view === 'trade-ledger') {
      let q = db('pickups')
        .join('matches',       'pickups.match_id',            'matches.id')
        .join('waste_listings','matches.listing_id',           'waste_listings.id')
        .join('generators',    'waste_listings.generator_id', 'generators.id')
        .join('profiles',      'generators.user_id',          'profiles.user_id')
        .join('facilities',    'matches.facility_id',          'facilities.id')
        .where('pickups.status', 'verified');

      if (dateStart) q = q.where('pickups.verified_at', '>=', new Date(dateStart as string));
      if (dateEnd)   q = q.where('pickups.verified_at', '<=', new Date(dateEnd as string));
      if (wasteType) q = q.where('waste_listings.waste_type', wasteType as string);
      q = await applyScope(q, user);

      const pickups = await q.select(
        'pickups.verified_at', 'pickups.co2_sequestered_t', 'pickups.distance_km',
        'waste_listings.waste_type', 'waste_listings.volume_t',
        db.raw("profiles.org_name as generator_name"),
        db.raw("facilities.name as facility_name"),
        'facilities.conversion_type'
      ).orderBy('pickups.verified_at', 'desc').limit(100);

      let totalCo2 = 0, totalWaste = 0, totalValue = 0, totalCost = 0;
      for (const p of pickups) {
        const co2  = parseFloat(String(p.co2_sequestered_t || 0));
        const vol  = parseFloat(String(p.volume_t         || 0));
        const dist = parseFloat(String(p.distance_km      || 0));
        const price = shadowPrice(p.conversion_type);
        totalCo2   += co2;
        totalWaste += vol;
        totalValue += co2 * price;
        totalCost  += vol * dist * TRANSPORT_COST_INR_PER_TONNE_KM;
      }

      doc.fontSize(14).font('Helvetica-Bold').fillColor('#166534').text(viewLabel);
      doc.moveDown(0.5);
      drawKpiTable(doc, [
        { label: 'CO2 Sequestered',    value: totalCo2.toFixed(2),    unit: 'tonnes CO2e' },
        { label: 'Waste Diverted',     value: totalWaste.toFixed(1),   unit: 'tonnes' },
        { label: 'Carbon Value',       value: fmtINR(Math.round(totalValue)), unit: 'estimated' },
        { label: 'Transport Cost',     value: fmtINR(Math.round(totalCost)),  unit: 'estimated' },
        { label: 'Net Value',          value: fmtINR(Math.round(totalValue - totalCost)), unit: 'estimated' },
        { label: 'Verified Pickups',   value: pickups.length.toString(), unit: 'transactions' },
      ]);

      if (view === 'trade-ledger' && pickups.length > 0) {
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text('Transaction Detail');
        doc.moveDown(0.3);
        drawDataTable(doc,
          ['Date', 'Generator', 'Waste Type', 'Volume (t)', 'Facility', 'CO2 (t)', 'Dist (km)'],
          pickups.map((p: Record<string, unknown>) => [
            fmtDate(p.verified_at as string),
            String(p.generator_name || '').slice(0, 20),
            String(p.waste_type || '').replace(/_/g, ' '),
            parseFloat(String(p.volume_t || 0)).toFixed(1),
            String(p.facility_name || '').slice(0, 20),
            parseFloat(String(p.co2_sequestered_t || 0)).toFixed(3),
            parseFloat(String(p.distance_km || 0)).toFixed(0),
          ]),
          [62, 75, 80, 55, 75, 55, 48]
        );
      }
    }

    if (view === 'pathway-economics') {
      let q = db('pickups')
        .join('matches',       'pickups.match_id',    'matches.id')
        .join('waste_listings','matches.listing_id',   'waste_listings.id')
        .join('facilities',    'matches.facility_id', 'facilities.id')
        .where('pickups.status', 'verified')
        .select('facilities.conversion_type')
        .count('pickups.id as pickup_count')
        .sum('waste_listings.volume_t as total_volume')
        .sum('pickups.co2_sequestered_t as total_co2')
        .avg('pickups.distance_km as avg_dist')
        .groupBy('facilities.conversion_type');
      if (dateStart) q = q.where('pickups.verified_at', '>=', new Date(dateStart as string));
      if (dateEnd)   q = q.where('pickups.verified_at', '<=', new Date(dateEnd as string));
      q = await applyScope(q, user);
      const rows = await q;

      doc.fontSize(14).font('Helvetica-Bold').fillColor('#166534').text('Pathway Economics Comparison');
      doc.moveDown(0.5);
      drawDataTable(doc,
        ['Pathway', 'Pickups', 'Volume (t)', 'CO2 (t)', 'CO2/t', 'LCOP (₹/t)', 'Shadow (₹/t)', 'Net Margin (₹)'],
        rows.map((r: Record<string, unknown>) => {
          const ct = String(r.conversion_type);
          const co2 = parseFloat(String(r.total_co2 || 0));
          const vol = parseFloat(String(r.total_volume || 0));
          const price = shadowPrice(ct);
          const lcop  = LCOP_BY_TYPE[ct] || 1500;
          return [
            CONVERSION_LABELS[ct] || ct,
            String(parseInt(String(r.pickup_count || 0), 10)),
            vol.toFixed(1),
            co2.toFixed(2),
            vol > 0 ? (co2 / vol).toFixed(3) : '0',
            lcop.toString(),
            price.toString(),
            Math.round(co2 * price - vol * lcop).toString(),
          ];
        }),
        [100, 45, 60, 55, 50, 65, 65, 80]
      );
    }

    if (view === 'investment-opportunities') {
      let facQ = db('facilities').select('*');
      if (user.role === 'facility_operator') facQ = facQ.where({ user_id: user.id });
      const facilities = await facQ;
      const facilityStats = await db('pickups')
        .join('matches', 'pickups.match_id', 'matches.id')
        .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
        .where('pickups.status', 'verified')
        .select('matches.facility_id')
        .avg('pickups.co2_sequestered_t as avg_co2').avg('waste_listings.volume_t as avg_volume')
        .count('pickups.id as pickup_count').groupBy('matches.facility_id');
      const sm = new Map(facilityStats.map((s: Record<string, unknown>) => [String(s.facility_id), s]));

      doc.fontSize(14).font('Helvetica-Bold').fillColor('#166534').text('Investment Opportunities');
      doc.moveDown(0.5);
      drawDataTable(doc,
        ['Facility', 'City', 'Pathway', 'Remaining Cap (t)', 'Headroom %', 'Break-Even (km)', '5Y DCF (₹)'],
        facilities.map((fac: Record<string, unknown>) => {
          const stats = sm.get(String(fac.id)) as Record<string, unknown> | undefined;
          const avgCo2 = parseFloat(String(stats?.avg_co2 || 0));
          const avgVol = parseFloat(String(stats?.avg_volume || 1));
          const co2PerT = avgVol > 0 ? avgCo2 / avgVol : 0;
          const rem = parseFloat(String(fac.remaining_capacity_t || 0));
          const cap = parseFloat(String(fac.capacity_t_month || 1));
          const price = shadowPrice(String(fac.conversion_type));
          const lcop  = LCOP_BY_TYPE[String(fac.conversion_type)] || 1500;
          const annualNet = rem * 12 * (co2PerT * price - lcop);
          const breakEven = co2PerT > 0 ? price * co2PerT / TRANSPORT_COST_INR_PER_TONNE_KM : 0;
          return [
            String(fac.name || '').slice(0, 22),
            String(fac.city || ''),
            (CONVERSION_LABELS[String(fac.conversion_type)] || '').split(' ')[0],
            rem.toFixed(0),
            cap > 0 ? Math.round((rem / cap) * 100).toString() + '%' : '0%',
            breakEven.toFixed(0),
            Math.round(Math.max(0, annualNet) * 3.791).toLocaleString('en-IN'),
          ];
        }),
        [90, 60, 75, 75, 60, 70, 90]
      );
    }

    drawMethodology(doc);
    addPdfFooters(doc, `CarbonLoop — ${viewLabel}`, timestamp);
    doc.end();
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  FULL REPORT PDF
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/reports/economics/full-report/pdf
router.get('/economics/full-report/pdf', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { dateStart, dateEnd } = req.query;
    const user = req.user!;
    const timestamp = new Date().toISOString();
    const ds = dateStart ? fmtDate(dateStart as string) : 'All time';
    const de = dateEnd   ? fmtDate(dateEnd   as string) : 'Present';
    const dateRange = `${ds} → ${de}`;

    // Fetch all data up front
    const baseFilter = (q: ReturnType<typeof db>) => {
      if (dateStart) q = q.where('pickups.verified_at', '>=', new Date(dateStart as string));
      if (dateEnd)   q = q.where('pickups.verified_at', '<=', new Date(dateEnd as string));
      return q;
    };

    let overviewQ = db('pickups').join('matches', 'pickups.match_id', 'matches.id')
      .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
      .join('facilities', 'matches.facility_id', 'facilities.id')
      .where('pickups.status', 'verified')
      .select('pickups.co2_sequestered_t', 'pickups.distance_km', 'waste_listings.volume_t', 'facilities.conversion_type');
    overviewQ = baseFilter(overviewQ);
    overviewQ = await applyScope(overviewQ, user);
    const overviewRows = await overviewQ;

    let totalCo2 = 0, totalWaste = 0, totalValue = 0, totalCost = 0;
    for (const p of overviewRows) {
      const co2 = parseFloat(String(p.co2_sequestered_t || 0));
      const vol = parseFloat(String(p.volume_t || 0));
      const dist = parseFloat(String(p.distance_km || 0));
      const price = shadowPrice(p.conversion_type);
      totalCo2 += co2; totalWaste += vol;
      totalValue += co2 * price; totalCost += vol * dist * TRANSPORT_COST_INR_PER_TONNE_KM;
    }

    let pathQ = db('pickups').join('matches', 'pickups.match_id', 'matches.id')
      .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
      .join('facilities', 'matches.facility_id', 'facilities.id')
      .where('pickups.status', 'verified').select('facilities.conversion_type')
      .count('pickups.id as pickup_count').sum('waste_listings.volume_t as total_volume')
      .sum('pickups.co2_sequestered_t as total_co2').groupBy('facilities.conversion_type');
    pathQ = baseFilter(pathQ); pathQ = await applyScope(pathQ, user);
    const pathwayRows = await pathQ;

    let ledgerQ = db('pickups').join('matches', 'pickups.match_id', 'matches.id')
      .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
      .join('generators', 'waste_listings.generator_id', 'generators.id')
      .join('profiles', 'generators.user_id', 'profiles.user_id')
      .join('facilities', 'matches.facility_id', 'facilities.id')
      .where('pickups.status', 'verified')
      .select('pickups.verified_at', 'pickups.co2_sequestered_t', 'pickups.distance_km',
        'waste_listings.waste_type', 'waste_listings.volume_t',
        db.raw("profiles.org_name as generator_name"),
        db.raw("facilities.name as facility_name"), 'facilities.conversion_type')
      .orderBy('pickups.verified_at', 'desc').limit(200);
    ledgerQ = baseFilter(ledgerQ); ledgerQ = await applyScope(ledgerQ, user);
    const ledgerRows = await ledgerQ;

    let facQ2 = db('facilities').select('*');
    if (user.role === 'facility_operator') facQ2 = facQ2.where({ user_id: user.id });
    const facilities = await facQ2;
    const facilityStats = await db('pickups')
      .join('matches', 'pickups.match_id', 'matches.id')
      .join('waste_listings', 'matches.listing_id', 'waste_listings.id')
      .where('pickups.status', 'verified')
      .select('matches.facility_id').avg('pickups.co2_sequestered_t as avg_co2')
      .avg('waste_listings.volume_t as avg_volume').count('pickups.id as pickup_count')
      .groupBy('matches.facility_id');
    const sm = new Map(facilityStats.map((s: Record<string, unknown>) => [String(s.facility_id), s]));

    // Find highest value pathway
    let highestPathway = pathwayRows.length > 0
      ? (pathwayRows as Record<string, unknown>[]).reduce((best, r) => {
          const netB = parseFloat(String(r.total_co2 || 0)) * shadowPrice(String(r.conversion_type));
          const netR = parseFloat(String(best.total_co2 || 0)) * shadowPrice(String(best.conversion_type));
          return netB > netR ? r : best;
        }, pathwayRows[0])
      : null;

    // BUILD PDF
    const doc = new PDFDocument({ margin: 50, bufferPages: true });
    const ds2 = dateStart ? String(dateStart).slice(0, 10) : 'all';
    const de2 = dateEnd   ? String(dateEnd).slice(0, 10)   : 'all';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="carbonloop-full-report-${ds2}-to-${de2}.pdf"`);
    doc.pipe(res);

    // ── COVER
    drawCover(doc, 'CarbonLoop — Full Economic Report', 'Consolidated Economic Analysis', dateRange, '', timestamp);

    // ── EXECUTIVE SUMMARY (new page)
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#166534').text('Executive Summary');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor('#374151');
    doc.text([
      `During the period ${ds} to ${de}, CarbonLoop facilitated ${overviewRows.length} verified waste-to-value transactions`,
      `across the network. A total of ${totalWaste.toFixed(1)} tonnes of organic waste was diverted from landfill or`,
      `open burning, sequestering ${totalCo2.toFixed(2)} tCO₂e. The estimated gross carbon value of this abatement`,
      `is ${fmtINR(Math.round(totalValue))}, against estimated transport costs of ${fmtINR(Math.round(totalCost))},`,
      `yielding an estimated net economic value of ${fmtINR(Math.round(totalValue - totalCost))}.`,
    ].join(' '), { align: 'justify' });
    if (highestPathway) {
      doc.moveDown(0.5);
      const hct = String(highestPathway.conversion_type);
      doc.text(`The highest-value pathway in this period was ${CONVERSION_LABELS[hct] || hct} ` +
        `(shadow price ${fmtINR(shadowPrice(hct))}/tCO₂e), contributing ` +
        `${fmtINR(Math.round(parseFloat(String(highestPathway.total_co2 || 0)) * shadowPrice(hct)))} gross carbon value.`,
        { align: 'justify' });
    }
    doc.moveDown(1.5);
    drawKpiTable(doc, [
      { label: 'Net Economic Value', value: fmtINR(Math.round(totalValue - totalCost)), unit: 'estimated' },
      { label: 'CO2 Sequestered',    value: totalCo2.toFixed(2),  unit: 'tonnes CO2e' },
      { label: 'Waste Diverted',     value: totalWaste.toFixed(1), unit: 'tonnes' },
      { label: 'Carbon Value',       value: fmtINR(Math.round(totalValue)), unit: 'gross, estimated' },
      { label: 'Transport Cost',     value: fmtINR(Math.round(totalCost)),  unit: 'estimated' },
      { label: 'Transactions',       value: overviewRows.length.toString(), unit: 'verified pickups' },
    ]);

    // ── SECTION 2: PATHWAY ECONOMICS
    doc.addPage();
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#166534').text('§2 Pathway Economics');
    doc.moveDown(0.4);
    doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
      .text('Net margin per pathway after deducting Levelised Cost of Processing from gross carbon shadow value.');
    doc.moveDown(0.5);
    drawDataTable(doc,
      ['Pathway', 'Pickups', 'Volume (t)', 'CO2 (t)', 'CO2/t', 'LCOP (₹/t)', 'Shadow Price', 'Net Margin (₹)'],
      (pathwayRows as Record<string, unknown>[]).map(r => {
        const ct = String(r.conversion_type);
        const co2 = parseFloat(String(r.total_co2 || 0));
        const vol = parseFloat(String(r.total_volume || 0));
        const price = shadowPrice(ct);
        const lcop = LCOP_BY_TYPE[ct] || 1500;
        return [
          (CONVERSION_LABELS[ct] || ct).split(' ')[0],
          String(parseInt(String(r.pickup_count || 0), 10)),
          vol.toFixed(1), co2.toFixed(2),
          vol > 0 ? (co2 / vol).toFixed(3) : '0',
          lcop.toString(), price.toString(),
          Math.round(co2 * price - vol * lcop).toLocaleString('en-IN'),
        ];
      }),
      [90, 42, 58, 52, 50, 62, 62, 84]
    );

    // ── SECTION 3: INVESTMENT OPPORTUNITIES
    doc.addPage();
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#166534').text('§3 Investment Opportunities');
    doc.moveDown(0.4);
    doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
      .text('Facilities ranked by 5-year discounted net value potential from remaining capacity. DCF at 10% over 5 years.');
    doc.moveDown(0.5);
    drawDataTable(doc,
      ['Facility', 'City', 'Pathway', 'Headroom (t)', 'Headroom%', 'Break-Even (km)', '5Y DCF (₹)'],
      facilities.slice(0, 15).map((fac: Record<string, unknown>) => {
        const stats = sm.get(String(fac.id)) as Record<string, unknown> | undefined;
        const avgCo2 = parseFloat(String(stats?.avg_co2 || 0));
        const avgVol = parseFloat(String(stats?.avg_volume || 1));
        const co2PerT = avgVol > 0 ? avgCo2 / avgVol : 0;
        const rem = parseFloat(String(fac.remaining_capacity_t || 0));
        const cap = parseFloat(String(fac.capacity_t_month || 1));
        const price = shadowPrice(String(fac.conversion_type));
        const lcop  = LCOP_BY_TYPE[String(fac.conversion_type)] || 1500;
        const annualNet = rem * 12 * (co2PerT * price - lcop);
        const breakEven = co2PerT > 0 ? price * co2PerT / TRANSPORT_COST_INR_PER_TONNE_KM : 0;
        return [
          String(fac.name || '').slice(0, 20), String(fac.city || ''),
          (CONVERSION_LABELS[String(fac.conversion_type)] || '').split(' ')[0],
          rem.toFixed(0),
          cap > 0 ? Math.round((rem / cap) * 100) + '%' : '0%',
          breakEven.toFixed(0),
          Math.round(Math.max(0, annualNet) * 3.791).toLocaleString('en-IN'),
        ];
      }),
      [90, 58, 72, 60, 60, 72, 88]
    );

    // ── APPENDIX: TRADE LEDGER
    doc.addPage();
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#166534').text('Appendix — Trade Ledger');
    doc.moveDown(0.4);
    doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
      .text(`All ${ledgerRows.length} verified transactions in the selected period (capped at 200).`);
    doc.moveDown(0.5);
    drawDataTable(doc,
      ['Date', 'Generator', 'Waste Type', 'Volume (t)', 'Facility', 'CO2 (t)', 'Dist (km)'],
      (ledgerRows as Record<string, unknown>[]).map(p => [
        fmtDate(p.verified_at as string),
        String(p.generator_name || '').slice(0, 20),
        String(p.waste_type || '').replace(/_/g, ' '),
        parseFloat(String(p.volume_t || 0)).toFixed(1),
        String(p.facility_name || '').slice(0, 20),
        parseFloat(String(p.co2_sequestered_t || 0)).toFixed(3),
        parseFloat(String(p.distance_km || 0)).toFixed(0),
      ]),
      [62, 75, 80, 55, 75, 55, 48]
    );

    // ── METHODOLOGY
    drawMethodology(doc);

    addPdfFooters(doc, 'CarbonLoop — Full Economic Report', timestamp);
    doc.end();
  } catch (err) { next(err); }
});

// ─── Existing report history (GET + POST) ────────────────────────────────────
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const reports = await db('reports')
      .where({ user_id: user.id })
      .orderBy('created_at', 'desc')
      .limit(50)
      .select('id', 'type', 'status', 'date_range_start', 'date_range_end', 'file_url', 'created_at', 'filters_json');
    res.json({ reports });
  } catch (err) { next(err); }
});

router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { type = 'impact', format = 'csv', dateRangeStart, dateRangeEnd, filtersJson } = req.body;
    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();
    await db('reports').insert({
      id,
      user_id: user.id,
      type,
      format,
      status: 'completed',
      date_range_start: dateRangeStart ? new Date(dateRangeStart) : new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      date_range_end:   dateRangeEnd   ? new Date(dateRangeEnd)   : new Date(),
      file_url: `/api/reports/${type === 'impact' ? 'impact' : `economics/${type}`}/${format}`,
      filters_json: filtersJson || null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    res.status(201).json({ message: `Report generation started (${format.toUpperCase()})`, reportId: id });
  } catch (err) { next(err); }
});

export default router;

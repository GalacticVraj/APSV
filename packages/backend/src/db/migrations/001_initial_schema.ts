import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Enable PostGIS (requires PostGIS extension installed in the DB)
  await knex.raw('CREATE EXTENSION IF NOT EXISTS postgis');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // users table
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('email', 320).notNullable().unique();
    table.string('password_hash', 100).notNullable();
    table.enum('role', [
      'generator',
      'facility_operator',
      'logistics_partner',
      'municipal_admin',
      'platform_admin',
    ]).notNullable();
    table.boolean('verified').notNullable().defaultTo(false);
    table.boolean('profile_verified').notNullable().defaultTo(false);
    table.timestamps(true, true);
  });

  // profiles table
  await knex.schema.createTable('profiles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('org_name', 200).notNullable();
    table.string('phone', 20);
    table.string('address', 500);
    table.string('city', 100);
    table.string('state', 100);
    table.string('pincode', 10);
    table.timestamps(true, true);
    table.index('user_id');
  });

  // generators table
  await knex.schema.createTable('generators', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('site_name', 200).notNullable();
    table.float('lat').notNullable();
    table.float('lng').notNullable();
    table.jsonb('waste_types').notNullable();
    table.float('avg_volume_t_month').notNullable();
    table.string('address', 500).notNullable();
    table.string('city', 100).notNullable();
    table.string('state', 100).notNullable();
    table.string('pincode', 10).notNullable();
    table.text('description');
    table.timestamps(true, true);
    table.index('user_id');
  });

  // Add PostGIS geometry column for generators
  await knex.raw(`
    ALTER TABLE generators ADD COLUMN IF NOT EXISTS location geometry(Point, 4326);
    UPDATE generators SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326);
    CREATE INDEX IF NOT EXISTS idx_generators_location ON generators USING GIST(location);
  `);

  // facilities table
  await knex.schema.createTable('facilities', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('name', 200).notNullable();
    table.float('lat').notNullable();
    table.float('lng').notNullable();
    table.enum('conversion_type', [
      'biochar_pyrolysis',
      'anaerobic_digestion',
      'aerobic_composting',
      'vermicomposting',
    ]).notNullable();
    table.float('capacity_t_month').notNullable();
    table.float('remaining_capacity_t').notNullable();
    table.jsonb('accepted_waste_types').notNullable();
    table.float('efficiency_pct').notNullable();
    table.float('service_radius_km').notNullable();
    table.string('address', 500).notNullable();
    table.string('city', 100).notNullable();
    table.string('state', 100).notNullable();
    table.string('pincode', 10).notNullable();
    table.text('description');
    table.boolean('verified').notNullable().defaultTo(false);
    table.timestamps(true, true);
    table.index('user_id');
  });

  await knex.raw(`
    ALTER TABLE facilities ADD COLUMN IF NOT EXISTS location geometry(Point, 4326);
    UPDATE facilities SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326);
    CREATE INDEX IF NOT EXISTS idx_facilities_location ON facilities USING GIST(location);
  `);

  // waste_listings table
  await knex.schema.createTable('waste_listings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('generator_id').notNullable().references('id').inTable('generators').onDelete('CASCADE');
    table.enum('waste_type', [
      'food_organic',
      'agricultural_biomass',
      'industrial_biomass',
      'municipal_organic',
      'food_processing',
      'restaurant_waste',
    ]).notNullable();
    table.float('volume_t').notNullable();
    table.enum('frequency', ['one_time', 'weekly', 'biweekly', 'monthly']).notNullable();
    table.timestamp('pickup_window_start').notNullable();
    table.timestamp('pickup_window_end').notNullable();
    table.enum('status', ['open', 'matched', 'completed', 'cancelled']).notNullable().defaultTo('open');
    table.text('notes');
    table.timestamps(true, true);
    table.index('generator_id');
    table.index('status');
  });

  // matches table
  await knex.schema.createTable('matches', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('listing_id').notNullable().references('id').inTable('waste_listings').onDelete('CASCADE');
    table.uuid('facility_id').notNullable().references('id').inTable('facilities').onDelete('CASCADE');
    table.float('score').notNullable();
    table.enum('status', ['pending', 'accepted', 'counter_proposed', 'declined', 'expired']).notNullable().defaultTo('pending');
    table.text('explanation_text');
    table.jsonb('match_breakdown');
    table.jsonb('counter_proposed_window');
    table.text('counter_message');
    table.timestamps(true, true);
    table.index('listing_id');
    table.index('facility_id');
    table.index('score');
  });

  // pickups table
  await knex.schema.createTable('pickups', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('match_id').notNullable().references('id').inTable('matches').onDelete('CASCADE');
    table.uuid('logistics_partner_id').references('id').inTable('users');
    table.enum('status', [
      'requested',
      'scheduled',
      'in_transit',
      'delivered',
      'verified',
      'cancelled',
    ]).notNullable().defaultTo('requested');
    table.timestamp('scheduled_at');
    table.timestamp('delivered_at');
    table.timestamp('verified_at');
    table.float('distance_km');
    table.float('co2_sequestered_t');
    table.string('vehicle_type', 50);
    table.text('notes');
    table.timestamps(true, true);
    table.index('match_id');
    table.index('status');
    table.index('logistics_partner_id');
  });

  // logistics_routes table
  await knex.schema.createTable('logistics_routes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('logistics_partner_id').notNullable().references('id').inTable('users');
    table.jsonb('stops').notNullable();
    table.float('total_distance_km').notNullable();
    table.float('total_time_min').notNullable();
    table.timestamps(true, true);
    table.index('logistics_partner_id');
  });

  // notifications table
  await knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('type', 50).notNullable();
    table.string('title', 200).notNullable();
    table.text('message').notNullable();
    table.boolean('read').notNullable().defaultTo(false);
    table.jsonb('data');
    table.timestamps(true, true);
    table.index('user_id');
    table.index('read');
  });

  // carbon_credits table
  await knex.schema.createTable('carbon_credits', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('pickup_id').notNullable().references('id').inTable('pickups').onDelete('CASCADE');
    table.float('tonnes_co2').notNullable();
    table.string('methodology', 200).notNullable();
    table.text('source_reference');
    table.boolean('verified').notNullable().defaultTo(false);
    table.timestamp('issued_at').notNullable().defaultTo(knex.fn.now());
    table.timestamps(true, true);
    table.index('pickup_id');
  });

  // disputes table
  await knex.schema.createTable('disputes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('pickup_id').notNullable().references('id').inTable('pickups').onDelete('CASCADE');
    table.uuid('reporter_id').notNullable().references('id').inTable('users');
    table.text('description').notNullable();
    table.enum('status', ['open', 'under_review', 'resolved', 'dismissed']).notNullable().defaultTo('open');
    table.text('resolution_note');
    table.timestamp('resolved_at');
    table.timestamps(true, true);
    table.index('status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('disputes');
  await knex.schema.dropTableIfExists('carbon_credits');
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('logistics_routes');
  await knex.schema.dropTableIfExists('pickups');
  await knex.schema.dropTableIfExists('matches');
  await knex.schema.dropTableIfExists('waste_listings');
  await knex.schema.dropTableIfExists('facilities');
  await knex.schema.dropTableIfExists('generators');
  await knex.schema.dropTableIfExists('profiles');
  await knex.schema.dropTableIfExists('users');
}

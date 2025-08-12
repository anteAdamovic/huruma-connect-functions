const { Client } = require('pg');
const fs = require('fs');
const csv = require('csv-parser');

const fileUrl = './data.csv';

const client = new Client({
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.cxqjkwdtdpvejkmzfwuz',
  password: 'VJd0zOwpmGJhMCr6',
  database: 'postgres', // or your custom DB name
  ssl: {
    rejectUnauthorized: false, // Required by Supabase
  },
});

function parseRawData(data) {
  const parsed = {
    country: 'Mozambique'
  };
  if (data.date_of_birth) {
    parsed.dob = data.date_of_birth;
  }
  if (data.city) {
    parsed.city = data.city;
  }
  if (data.province) {
    parsed.province = data.province;
  }
  if (data.suburb) {
    parsed.suburb = data.suburb;
  }
  if (data.gender) {
    if (data.gender === 'male') parsed.gender = 'MALE';
    else if (data.gender === 'female') parsed.gender = 'FEMALE';
    else parsed.gender = 'OTHER';
  }
  if (data.education_level) {
    if (data.education_level === 'primary') parsed.education_level = 'PRIMARY';
    else if (data.education_level === 'secondary') parsed.education_level = 'SECONDARY';
    else if (data.education_level === 'bachelor\'s') parsed.education_level = 'BACHELOR';
    else parsed.education_level = 'NONE';
  }
  if (data.mental_health_rating) {
    parsed.mental_health_rating = data.mental_health_rating;
  }
  if (data.ethnic_background) {
    if (data.ethnic_background === 'black') parsed.ethnicity = 'BLACK';
    else if (data.ethnic_background === 'caucasian') parsed.ethnicity = 'WHITE';
    else if (data.ethnic_background === 'mixed heritage') parsed.ethnicity = 'MIXED';
    else parsed.ethnicity = 'OTHER';
  }
  if(data.physical_activity_level) {
    if (data.physical_activity_level === 'not_active') data.physical_activity = 'NONE';
    else if (data.physical_activity_level === 'slightly_active') data.physical_activity = 'LOW';
    else if (data.physical_activity_level === 'occasionally_active') data.physical_activity = 'LOW';
    else if (data.physical_activity_level === 'moderately_active') data.physical_activity = 'REGULAR';
    else if (data.physical_activity_level === 'very_active') data.physical_activity = 'HIGH';
    else data.physical_activity = 'NONE';
  }
  if (data.smoking_status) {
    if (data.smoking_status === 'none' || data.smoking_status === 'quit') data.smoking = 'NONE';
    else if (data.smoking_status === 'household_only') data.smoking = 'PASSIVE';
    else if (data.smoking_status === 'occasional') data.smoking = 'OCCASIONAL';
    else if (data.smoking_status === 'regular') data.smoking = 'REGULAR';
    else data.smoking = 'NONE';
  }
  if (data.fruit_vegetable_intake) {
    if (data.fruit_vegetable_intake === 'rarely') data.produce_intake = 'NONE';
    else if (data.fruit_vegetable_intake === '3_4_weekly') data.produce_intake = 'LOW';
    else if (data.fruit_vegetable_intake === '1_2_weekly') data.produce_intake = 'LOW';
    else if (data.fruit_vegetable_intake === '1_2_days') data.produce_intake = 'REGULAR';
    else if (data.fruit_vegetable_intake === '3_4_days') data.produce_intake = 'REGULAR';
    else if (data.fruit_vegetable_intake === 'daily') data.produce_intake = 'REGULAR';
  }
  if (data.alcohol_use) {
    if (data.alcohol_use === 'none') data.alcohol_use = 'NONE';
    else if (data.alcohol_use === 'household_only') data.alcohol_use = 'NONE';
    else if (data.alcohol_use === 'occasional') data.alcohol_use = 'LOW';
    else if (data.alcohol_use === 'regular') data.alcohol_use = 'REGULAR';
  }
  if (data.marital_status) {

  }
  if (data.chronic_conditions) {

  }
  if (data.preferred_language) {

  }
  return parsed;
}

async function putData(row) {
  const rawData = parseRawData(row);
  const data = {
    phone_number: row.phone,
    created_at: row.created_at,
    stage: row.status,
    onboarding_type: row.source,
    name: row.name,
    raw: row.raw
  }

  return rawData;
  try {
    await client.connect();
    const res = await client.query(`
      INSERT INTO whatsapp_users (phone_number, created_at, stage, onboarding_type, name, raw, ${Object.keys(rawData).join(', ')})
      VALUES ($1, $2, $3, $4, $5, $6, ${Object.entries(rawData).map((entry, i) => `$${i + 7}`)})`);
  } catch (err) {
    console.error('Error querying Postgres:', err);
  } finally {
    await client.end();
  }
}

function loadData(data) {
  data.forEach(row => {
    putData(row).then((result) => console.log(result));
  })
}

const results = [];

fs.createReadStream(fileUrl)
  .pipe(csv())
  .on('data', (row) => {
    results.push(row);
  })
  .on('end', () => {
    console.log('CSV file successfully processed!');
  });

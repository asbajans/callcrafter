import 'dotenv/config';
import { getPayload } from 'payload';
import config from '../../payload.config.ts';

async function seed() {
  const payload = await getPayload({ config });

  // 1. Create super admin user
  const adminEmail = 'admin@callcrafter.com';
  const existingAdmin = await payload.find({
    collection: 'users',
    where: { email: { equals: adminEmail } },
  });

  if (existingAdmin.docs.length === 0) {
    await payload.create({
      collection: 'users',
      data: {
        email: adminEmail,
        password: 'Admin123!',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'super-admin',
        status: 'active',
      },
    });
    console.log('✅ Super admin created: admin@callcrafter.com / Admin123!');
  } else {
    console.log('ℹ️  Admin already exists');
  }

  // 2. Create default pricing plans
  const plans = [
    {
      name: 'Free',
      description: 'Başlangıç seviyesi, 1 agent ile test edin',
      price: 0,
      billingCycle: 'monthly',
      features: [
        { name: 'AI Agent', value: '1 adet', included: true },
        { name: 'Telefon Numarası', value: '1 adet', included: true },
        { name: 'Görüşme Süresi', value: '100 dk/ay', included: true },
        { name: 'Eğitim Dokümanı', value: '5 adet', included: true },
      ],
      limits: { agents: 1, phoneNumbers: 1, conversationsPerMonth: 100, minutesPerMonth: 100, trainingDocs: 5 },
      status: 'active',
      displayOrder: 0,
    },
    {
      name: 'Starter',
      price: 49,
      billingCycle: 'monthly',
      description: 'Küçük işletmeler için ideal',
      features: [
        { name: 'AI Agent', value: '3 adet', included: true },
        { name: 'Telefon Numarası', value: '3 adet', included: true },
        { name: 'Görüşme Süresi', value: '500 dk/ay', included: true },
        { name: 'Eğitim Dokümanı', value: '20 adet', included: true },
        { name: 'WhatsApp Entegrasyonu', value: 'Var', included: true },
      ],
      limits: { agents: 3, phoneNumbers: 3, conversationsPerMonth: 500, minutesPerMonth: 500, trainingDocs: 20 },
      status: 'active',
      displayOrder: 1,
    },
    {
      name: 'Professional',
      price: 149,
      billingCycle: 'monthly',
      description: 'Büyüyen işletmeler için tam çözüm',
      features: [
        { name: 'AI Agent', value: '10 adet', included: true },
        { name: 'Telefon Numarası', value: '10 adet', included: true },
        { name: 'Görüşme Süresi', value: '2000 dk/ay', included: true },
        { name: 'Eğitim Dokümanı', value: 'Sınırsız', included: true },
        { name: 'WhatsApp + Instagram', value: 'Var', included: true },
        { name: 'Kendi SIP Trunk', value: 'Var', included: true },
      ],
      limits: { agents: 10, phoneNumbers: 10, conversationsPerMonth: 2000, minutesPerMonth: 2000, trainingDocs: 100 },
      status: 'active',
      displayOrder: 2,
    },
    {
      name: 'Enterprise',
      price: 499,
      billingCycle: 'monthly',
      description: 'Kurumsal müşteriler için özel çözüm',
      features: [
        { name: 'AI Agent', value: 'Sınırsız', included: true },
        { name: 'Telefon Numarası', value: 'Sınırsız', included: true },
        { name: 'Görüşme Süresi', value: 'Sınırsız', included: true },
        { name: 'Eğitim Dokümanı', value: 'Sınırsız', included: true },
        { name: 'Tüm Kanallar', value: 'Var', included: true },
        { name: 'Özel Entegrasyon', value: 'Var', included: true },
        { name: 'Öncelikli Destek', value: '7/24', included: true },
      ],
      limits: { agents: 999, phoneNumbers: 999, conversationsPerMonth: 999999, minutesPerMonth: 999999, trainingDocs: 9999 },
      status: 'active',
      displayOrder: 3,
    },
  ];

  for (const plan of plans) {
    const existing = await payload.find({
      collection: 'pricing-plans',
      where: { name: { equals: plan.name } },
    });
    if (existing.docs.length === 0) {
      await payload.create({ collection: 'pricing-plans', data: plan });
      console.log(`✅ Plan created: ${plan.name} ($${plan.price})`);
    } else {
      console.log(`ℹ️  Plan already exists: ${plan.name}`);
    }
  }

  // 3. Create default voices
  const voices = [
    { name: 'Ahmet (TR - Erkek)', provider: 'elevenlabs', providerVoiceId: '21m00Tcm4TlvDq8ikWAM', language: 'tr', gender: 'male', status: 'active', isPublic: true },
    { name: 'Rachel (EN - Kadın)', provider: 'elevenlabs', providerVoiceId: '21m00Tcm4TlvDq8ikWAM', language: 'en', gender: 'female', status: 'active', isPublic: true },
    { name: 'Domi (EN - Kadın)', provider: 'elevenlabs', providerVoiceId: 'AZnzlk1XvdvUeBnXmlld', language: 'en', gender: 'female', status: 'active', isPublic: true },
    { name: 'Bella (EN - Kadın)', provider: 'elevenlabs', providerVoiceId: 'EXAVITQu4vr2n3Q6GLGS', language: 'en', gender: 'female', status: 'active', isPublic: true },
    { name: 'Antoni (EN - Erkek)', provider: 'elevenlabs', providerVoiceId: 'ErXwobaYiN019PkySvjV', language: 'en', gender: 'male', status: 'active', isPublic: true },
  ];

  for (const voice of voices) {
    const existing = await payload.find({
      collection: 'voice-configs',
      where: { name: { equals: voice.name } },
    });
    if (existing.docs.length === 0) {
      await payload.create({ collection: 'voice-configs', data: voice });
      console.log(`✅ Voice created: ${voice.name}`);
    }
  }

  console.log('\n🎉 Seed complete!');
  console.log('   Admin: admin@callcrafter.com / Admin123!');
  console.log('   Plans: Free, Starter ($49), Professional ($149), Enterprise ($499)');
  console.log('   Voices: Ahmet, Rachel, Domi, Bella, Antoni');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

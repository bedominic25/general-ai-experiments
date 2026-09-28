import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { embed } from "../src/ai/vectorizer.js";
import { hashPassword } from "../src/auth/password.js";

const prisma = new PrismaClient();

interface SeedProduct {
  sku: string;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  stock: number;
  imageUrl: string;
}

const PRODUCTS: SeedProduct[] = [
  { sku: "SHO-001", name: "TrailBlazer Winter Running Shoes", description: "Insulated, waterproof running shoes built for cold-weather trails and icy pavement.", category: "footwear", priceCents: 8999, stock: 40, imageUrl: "/images/trailblazer-winter.svg" },
  { sku: "SHO-002", name: "UrbanStride Everyday Sneakers", description: "Lightweight everyday sneakers with breathable mesh, great for city walking and light jogging.", category: "footwear", priceCents: 6499, stock: 60, imageUrl: "/images/urbanstride.svg" },
  { sku: "SHO-003", name: "SummitGrip Hiking Boots", description: "Rugged ankle-support hiking boots with an aggressive tread for muddy, uneven terrain.", category: "footwear", priceCents: 12999, stock: 25, imageUrl: "/images/summitgrip.svg" },
  { sku: "ELC-001", name: "PulseBeat Wireless Earbuds", description: "Noise-isolating wireless earbuds with 30-hour battery life and quick charge.", category: "electronics", priceCents: 5999, stock: 80, imageUrl: "/images/pulsebeat.svg" },
  { sku: "ELC-002", name: "ClearView 27in 4K Monitor", description: "27-inch 4K IPS monitor with USB-C power delivery, ideal for a home office desk setup.", category: "electronics", priceCents: 32999, stock: 15, imageUrl: "/images/clearview-monitor.svg" },
  { sku: "ELC-003", name: "NightOwl Smart Desk Lamp", description: "Adjustable smart desk lamp with warm/cool LED modes and a built-in USB charging port.", category: "electronics", priceCents: 3499, stock: 50, imageUrl: "/images/nightowl-lamp.svg" },
  { sku: "OUT-001", name: "AlpineShield 3-Season Tent", description: "Two-person freestanding tent rated for spring through fall backpacking trips.", category: "outdoor", priceCents: 18999, stock: 12, imageUrl: "/images/alpineshield-tent.svg" },
  { sku: "OUT-002", name: "GlacierGuard Insulated Jacket", description: "Down-insulated jacket for winter hikes and sub-freezing commutes, packs into its own pocket.", category: "outdoor", priceCents: 15999, stock: 20, imageUrl: "/images/glacierguard-jacket.svg" },
  { sku: "OUT-003", name: "BaseCamp Compact Camp Stove", description: "Foldable backpacking camp stove that boils a liter of water in under 3 minutes.", category: "outdoor", priceCents: 4499, stock: 35, imageUrl: "/images/basecamp-stove.svg" },
  { sku: "HOM-001", name: "CozyDrift Weighted Blanket", description: "15lb weighted blanket for better sleep, machine-washable cotton cover.", category: "home", priceCents: 7499, stock: 45, imageUrl: "/images/cozydrift-blanket.svg" },
  { sku: "HOM-002", name: "BrewPeak Pour-Over Coffee Set", description: "Ceramic pour-over dripper and carafe set for a slow, controlled morning coffee.", category: "home", priceCents: 4299, stock: 55, imageUrl: "/images/brewpeak-pourover.svg" },
  { sku: "HOM-003", name: "QuietHum Air Purifier", description: "HEPA air purifier for bedrooms up to 300 sq ft, whisper-quiet on the low setting.", category: "home", priceCents: 9999, stock: 30, imageUrl: "/images/quiethum-purifier.svg" },
  { sku: "BOK-001", name: "The Long Winter Trail", description: "A memoir about hiking the Pacific Crest Trail through an unusually harsh winter.", category: "books", priceCents: 1899, stock: 70, imageUrl: "/images/long-winter-trail-book.svg" },
  { sku: "BOK-002", name: "Systems That Ship", description: "A practical guide to building and testing reliable distributed systems.", category: "books", priceCents: 2999, stock: 65, imageUrl: "/images/systems-that-ship-book.svg" },
  { sku: "FIT-001", name: "CoreFlex Yoga Mat", description: "Extra-thick non-slip yoga mat with alignment lines, great for home workouts.", category: "fitness", priceCents: 3999, stock: 90, imageUrl: "/images/coreflex-mat.svg" },
  { sku: "FIT-002", name: "IronPath Adjustable Dumbbells", description: "Space-saving adjustable dumbbell pair, 5 to 50 lbs per hand in one unit.", category: "fitness", priceCents: 24999, stock: 18, imageUrl: "/images/ironpath-dumbbells.svg" },
];

async function main() {
  console.log(`Seeding ${PRODUCTS.length} products...`);

  for (const p of PRODUCTS) {
    const embedding = JSON.stringify(embed(`${p.name} ${p.description} ${p.category}`));
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: { ...p, embedding },
      create: { ...p, embedding },
    });
  }

  const demoEmail = "demo@shopsphere.dev";
  const existingDemo = await prisma.user.findUnique({ where: { email: demoEmail } });
  if (!existingDemo) {
    await prisma.user.create({
      data: {
        email: demoEmail,
        name: "Demo Shopper",
        passwordHash: await hashPassword("Password123!"),
      },
    });
    console.log(`Created demo user: ${demoEmail} / Password123!`);
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { prisma } from "../db/client.js";

export class CartError extends Error {}

export async function getCart(userId: string) {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: { product: true },
    orderBy: { createdAt: "asc" },
  });

  const totalCents = items.reduce((sum, item) => sum + item.quantity * item.product.priceCents, 0);
  return {
    items: items.map((item) => ({
      productId: item.productId,
      name: item.product.name,
      priceCents: item.product.priceCents,
      imageUrl: item.product.imageUrl,
      quantity: item.quantity,
    })),
    totalCents,
  };
}

export async function addToCart(userId: string, productId: string, quantity: number) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw new CartError("Product not found");
  }
  if (product.stock < quantity) {
    throw new CartError("Not enough stock available");
  }

  await prisma.cartItem.upsert({
    where: { userId_productId: { userId, productId } },
    update: { quantity: { increment: quantity } },
    create: { userId, productId, quantity },
  });

  return getCart(userId);
}

export async function removeFromCart(userId: string, productId: string) {
  await prisma.cartItem.deleteMany({ where: { userId, productId } });
  return getCart(userId);
}

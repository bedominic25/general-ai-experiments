import { prisma } from "../db/client.js";

export class OrderError extends Error {}

export async function checkout(userId: string) {
  const cartItems = await prisma.cartItem.findMany({
    where: { userId },
    include: { product: true },
  });

  if (cartItems.length === 0) {
    throw new OrderError("Cart is empty");
  }

  for (const item of cartItems) {
    if (item.product.stock < item.quantity) {
      throw new OrderError(`Not enough stock for ${item.product.name}`);
    }
  }

  const totalCents = cartItems.reduce((sum, item) => sum + item.quantity * item.product.priceCents, 0);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId,
        totalCents,
        items: {
          create: cartItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPriceCents: item.product.priceCents,
          })),
        },
      },
      include: { items: true },
    });

    for (const item of cartItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    await tx.cartItem.deleteMany({ where: { userId } });

    return created;
  });

  return order;
}

export function listOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

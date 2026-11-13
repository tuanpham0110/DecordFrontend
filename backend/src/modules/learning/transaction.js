import { prisma } from '../../lib/prisma.js';

/** Serialize learner mutations before reading mutable session/card state. */
export function learnerTransaction(userId, work) {
    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
        return work(tx);
    }, { isolationLevel: 'ReadCommitted' });
}

const prisma = require("./db.js");

async function generateNumber(type) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    // Combine type + year + month as unique key for monthly sequence
    const key = `${type}-${year}${month}`;

    const result = await prisma.$transaction(async (tx) => {
        const seq = await tx.sequence.upsert({
            where: { type: key },
            update: { currentNumber: { increment: 1 } },
            create: { type: key, currentNumber: 1 },
        });
        return seq.currentNumber;
    });

    const formatted = `${type.slice(0, 3).toUpperCase()}-${year}${month}-${String(result).padStart(6, "0")}`;
    return formatted;
}

module.exports = { generateNumber };

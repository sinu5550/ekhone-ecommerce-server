const prisma = require('./db');

/**
 * Generate next sequential code for MainCategory ('A'), Category ('B'), or SubCategory ('C')
 * @param {'mainCategory' | 'category' | 'subCategory'} modelName 
 * @param {string} prefix ('A' | 'B' | 'C')
 * @returns {Promise<string>} e.g. 'A007', 'B005', 'C010'
 */
async function generateCategoryCode(modelName, prefix) {
    const items = await prisma[modelName].findMany({
        select: { code: true }
    });

    const regex = new RegExp(`^${prefix}(\\d+)$`, 'i');
    let maxNum = 0;

    for (const item of items) {
        const code = (item?.code || '').trim();
        const match = code.match(regex);
        if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) {
                maxNum = num;
            }
        }
    }

    const nextNum = maxNum > 0 ? maxNum + 1 : (items.length + 1);
    let candidate = `${prefix}${String(nextNum).padStart(3, '0')}`;

    // Safety check to ensure uniqueness
    let counter = nextNum;
    while (await prisma[modelName].findUnique({ where: { code: candidate } })) {
        counter++;
        candidate = `${prefix}${String(counter).padStart(3, '0')}`;
    }

    return candidate;
}

module.exports = { generateCategoryCode };

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Starting database seed for Ekhone...");

    // ---------- ADMIN ROLE & PERMISSIONS ----------
    const superAdminRole = await prisma.adminRole.upsert({
        where: { name: "Super Admin" },
        update: {},
        create: {
            name: "Super Admin",
        },
    });

    const adminUser = await prisma.adminUser.upsert({
        where: { email: "ahmedsiyan33@gmail.com" },
        update: {},
        create: {
            name: "Siyan Admin",
            email: "ahmedsiyan33@gmail.com",
            roleId: superAdminRole.id,
            status: "Active",
        },
    });

    // ---------- MAIN CATEGORY ----------
    const mainCategory = await prisma.mainCategory.upsert({
        where: { code: "ELEC" },
        update: {},
        create: {
            code: "ELEC",
            name: "Electronics",
            image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=500",
            description: "Electronic devices and accessories",
            status: true,
        },
    });

    // ---------- CATEGORY ----------
    const category = await prisma.category.upsert({
        where: { code: "MOB" },
        update: {},
        create: {
            code: "MOB",
            name: "Mobiles & Gadgets",
            image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500",
            mainCategoryId: mainCategory.id,
            status: true,
        },
    });

    // ---------- SUBCATEGORY ----------
    const subCategory = await prisma.subCategory.upsert({
        where: { code: "SMART" },
        update: {},
        create: {
            code: "SMART",
            name: "Smartphones",
            categoryId: category.id,
            status: true,
        },
    });

    // ---------- BRAND ----------
    let brand = await prisma.brand.findFirst({
        where: { name: "Samsung" },
    });
    if (!brand) {
        brand = await prisma.brand.create({
            data: {
                name: "Samsung",
                image: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500",
            },
        });
    }

    // ---------- UNIT ----------
    let unit = await prisma.unit.findFirst({
        where: { name: "Piece" },
    });
    if (!unit) {
        unit = await prisma.unit.create({
            data: {
                name: "Piece",
                shortName: "pc",
            },
        });
    }

    // ---------- VARIANT ATTRIBUTES ----------
    let variantAttr = await prisma.variantAttributes.findFirst({
        where: { variant: "Color" },
    });
    if (!variantAttr) {
        variantAttr = await prisma.variantAttributes.create({
            data: {
                variant: "Color",
                values: ["Black", "White", "Titanium Gray"],
            },
        });
    }

    // ---------- WARRANTY ----------
    let warranty = await prisma.warranty.findFirst({
        where: { name: "1 Year Official Warranty" },
    });
    if (!warranty) {
        warranty = await prisma.warranty.create({
            data: {
                name: "1 Year Official Warranty",
                duration: 12,
                period: "Months",
                description: "Covers official manufacturing defects for 1 year",
                status: true,
            },
        });
    }

    // ---------- PRODUCT ----------
    const product = await prisma.product.upsert({
        where: { slug: "samsung-galaxy-s24-ultra" },
        update: {},
        create: {
            slug: "samsung-galaxy-s24-ultra",
            sku: "S24U-001",
            productName: "Samsung Galaxy S24 Ultra",
            sellingType: "Retail",
            subCategoryId: subCategory.id,
            brandId: brand.id,
            unitId: unit.id,
            warrantyId: warranty.id,
            variantAttributesId: variantAttr.id,
            price: 145000.0,
            costPrice: 130000.0,
            quantity: 25,
            images: ["https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500"],
            description: "Flagship smartphone with cutting-edge camera and AI capabilities.",
            taxType: "VAT",
            tax: 0,
            status: true,
            insideDhakaDeliveryCharge: 60.0,
            outsideDhakaDeliveryCharge: 120.0,
        },
    });

    // ---------- CUSTOMER ----------
    const customer = await prisma.customer.upsert({
        where: { customerCode: "CUST001" },
        update: {},
        create: {
            customerCode: "CUST001",
            fullName: "Siyan Ahmed",
            email: "siyan@example.com",
            phone: "01700000000",
            status: true,
        },
    });

    // ---------- CUSTOMER ADDRESS ----------
    let address = await prisma.customerAddress.findFirst({
        where: { customerId: customer.id },
    });
    if (!address) {
        address = await prisma.customerAddress.create({
            data: {
                customerId: customer.id,
                recipientName: "Siyan Ahmed",
                phoneNumber: "01700000000",
                address: "Dhaka, Bangladesh",
                upazila: "Gulshan",
                district: "Dhaka",
                division: "Dhaka",
                city: "Dhaka",
                country: "Bangladesh",
                isDefault: true,
            },
        });
    }

    // ---------- DEFAULT ACCOUNT HEADS ----------
    const defaultHeads = [
        { code: "AH-INC-001", title: "Direct Product Sales", type: "INCOME", description: "Revenue from ekhone orders", isSystem: true },
        { code: "AH-INC-002", title: "Delivery / Shipping Charges Collected", type: "INCOME", description: "Delivery fees collected", isSystem: true },
        { code: "AH-EXP-001", title: "Digital Marketing & Ads", type: "EXPENSE", description: "Facebook and Google ads", isSystem: true },
        { code: "AH-EXP-002", title: "Courier Delivery Charges", type: "EXPENSE", description: "Steadfast and Pathao shipping fees", isSystem: true },
        { code: "AH-EXP-003", title: "Packaging & Supplies", type: "EXPENSE", description: "Boxes, tape, flyers", isSystem: true },
        { code: "AH-EXP-004", title: "Office Rent & Warehouse", type: "EXPENSE", description: "Office rental", isSystem: false },
    ];

    for (const head of defaultHeads) {
        const existingHead = await prisma.accountHead.findFirst({
            where: {
                OR: [
                    { title: { equals: head.title, mode: "insensitive" } },
                    { code: head.code },
                ],
            },
        });
        if (!existingHead) {
            await prisma.accountHead.create({ data: head });
        }
    }

    console.log("✅ Seed completed successfully for Ekhone.");
    console.table({
        AdminUser: adminUser.email,
        MainCategory: mainCategory.name,
        Category: category.name,
        SubCategory: subCategory.name,
        Brand: brand.name,
        Product: product.productName,
        Customer: customer.fullName,
    });
}

// Execute
main()
    .catch((err) => {
        console.error("❌ Seed failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

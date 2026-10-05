const { PrismaClient } = require("@prisma/client");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const prisma = new PrismaClient();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

async function main() {
  console.log("🌱 Starting database seed for Ekhone...");

  // ---------- SYNC SUPABASE AUTH USER ----------
  const adminEmail = "ahmedsiyan33@gmail.com";
  const defaultPassword = "AdminPassword123!"; // You can log in with this or reset it anytime

  try {
    const { data: userList } = await supabase.auth.admin.listUsers();
    const existingAuthUser = userList?.users?.find(
      (u) => u.email === adminEmail,
    );

    if (!existingAuthUser) {
      console.log(`Creating Supabase Auth user for ${adminEmail}...`);
      const { error: createError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: { full_name: "Siyan Admin" },
      });
      if (createError) {
        console.error("Supabase user creation error:", createError.message);
      } else {
        console.log(
          `✅ Supabase Auth user created successfully! (Default Password: ${defaultPassword})`,
        );
      }
    } else {
      console.log(
        `Supabase Auth user ${adminEmail} already exists. Updating to confirmed...`,
      );
      await supabase.auth.admin.updateUserById(existingAuthUser.id, {
        email_confirm: true,
      });
      console.log("✅ Supabase Auth user confirmed.");
    }
  } catch (authErr) {
    console.warn("Could not sync with Supabase Auth:", authErr.message);
  }

  // ---------- ADMIN ROLE & PERMISSIONS ----------
  const systemAdminRole = await prisma.adminRole.upsert({
    where: { name: "system_admin" },
    update: {},
    create: {
      name: "system_admin",
    },
  });

  const adminUser = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {
      roleId: systemAdminRole.id,
    },
    create: {
      name: "Siyan Admin",
      email: adminEmail,
      roleId: systemAdminRole.id,
      status: "Active",
    },
  });

  // ---------- SEED PERMISSIONS (108 Permissions) ----------
  const permissionsList = [
    { module: "courier", action: "Steadfast", slug: "courier.steadfast" },
    { module: "courier", action: "pathao", slug: "courier.pathao" },
    { module: "collections", action: "view", slug: "collections.view" },
    { module: "collections", action: "delete", slug: "collections.delete" },
    { module: "collections", action: "update", slug: "collections.update" },
    { module: "collections", action: "create", slug: "collections.create" },
    { module: "analytics", action: "metapixel_view", slug: "analytics.metapixel_view" },
    { module: "analytics", action: "google_view", slug: "analytics.google_view" },
    { module: "role_management", action: "delete", slug: "role_management.delete" },
    { module: "user_role", action: "delete", slug: "user_role.delete" },
    { module: "user_role", action: "update", slug: "user_role.update" },
    { module: "user_role", action: "create", slug: "user_role.create" },
    { module: "user_role", action: "view", slug: "user_role.view" },
    { module: "user_permission", action: "delete", slug: "user_permission.delete" },
    { module: "user_permission", action: "update", slug: "user_permission.update" },
    { module: "user_permission", action: "view", slug: "user_permission.view" },
    { module: "user_permission", action: "create", slug: "user_permission.create" },
    { module: "enquiry_us", action: "details", slug: "enquiry_us.details" },
    { module: "enquiry_us", action: "delete", slug: "enquiry_us.delete" },
    { module: "enquiry_us", action: "email_reply", slug: "enquiry_us.email_reply" },
    { module: "enquiry_us", action: "view", slug: "enquiry_us.view" },
    { module: "cms", action: "delete", slug: "cms.delete" },
    { module: "cms", action: "update", slug: "cms.update" },
    { module: "cms", action: "create", slug: "cms.create" },
    { module: "cms", action: "view", slug: "cms.view" },
    { module: "access_management", action: "assign_role_permissions", slug: "access_management.assign_role_permissions" },
    { module: "access_management", action: "view", slug: "access_management.view" },
    { module: "unit", action: "view", slug: "unit.view" },
    { module: "unit", action: "create", slug: "unit.create" },
    { module: "unit", action: "update", slug: "unit.update" },
    { module: "unit", action: "delete", slug: "unit.delete" },
    { module: "variant_attribute", action: "view", slug: "variant_attribute.view" },
    { module: "variant_attribute", action: "create", slug: "variant_attribute.create" },
    { module: "variant_attribute", action: "update", slug: "variant_attribute.update" },
    { module: "variant_attribute", action: "delete", slug: "variant_attribute.delete" },
    { module: "warranty", action: "view", slug: "warranty.view" },
    { module: "warranty", action: "create", slug: "warranty.create" },
    { module: "warranty", action: "update", slug: "warranty.update" },
    { module: "warranty", action: "delete", slug: "warranty.delete" },
    { module: "warranty", action: "status_update", slug: "warranty.status_update" },
    { module: "manage_stock", action: "view", slug: "manage_stock.view" },
    { module: "manage_stock", action: "update", slug: "manage_stock.update" },
    { module: "stock_adjustment", action: "view", slug: "stock_adjustment.view" },
    { module: "stock_adjustment", action: "update_stock", slug: "stock_adjustment.update_stock" },
    { module: "order", action: "create", slug: "order.create" },
    { module: "order", action: "view", slug: "order.view" },
    { module: "order", action: "update", slug: "order.update" },
    { module: "order", action: "delete", slug: "order.delete" },
    { module: "order", action: "payment_update", slug: "order.payment_update" },
    { module: "order", action: "status_update", slug: "order.status_update" },
    { module: "order", action: "view_details", slug: "order.view_details" },
    { module: "order", action: "export_excel", slug: "order.export_excel" },
    { module: "invoice", action: "create", slug: "invoice.create" },
    { module: "invoice", action: "view", slug: "invoice.view" },
    { module: "invoice", action: "view_details", slug: "invoice.view_details" },
    { module: "invoice", action: "export_pdf", slug: "invoice.export_pdf" },
    { module: "coupon", action: "view", slug: "coupon.view" },
    { module: "coupon", action: "create", slug: "coupon.create" },
    { module: "coupon", action: "update", slug: "coupon.update" },
    { module: "coupon", action: "delete", slug: "coupon.delete" },
    { module: "coupon", action: "status_update", slug: "coupon.status_update" },
    { module: "discount", action: "view", slug: "discount.view" },
    { module: "discount", action: "create", slug: "discount.create" },
    { module: "discount", action: "update", slug: "discount.update" },
    { module: "discount", action: "delete", slug: "discount.delete" },
    { module: "discount", action: "status_update", slug: "discount.status_update" },
    { module: "bundle_product", action: "view", slug: "bundle_product.view" },
    { module: "dashboard", action: "view", slug: "dashboard.view" },
    { module: "bundle_product", action: "update", slug: "bundle_product.update" },
    { module: "bundle_product", action: "delete", slug: "bundle_product.delete" },
    { module: "bundle_product", action: "status_update", slug: "bundle_product.status_update" },
    { module: "customer", action: "view", slug: "customer.view" },
    { module: "customer", action: "create", slug: "customer.create" },
    { module: "customer", action: "update", slug: "customer.update" },
    { module: "customer", action: "delete", slug: "customer.delete" },
    { module: "customer", action: "status_update", slug: "customer.status_update" },
    { module: "customer", action: "view_details", slug: "customer.view_details" },
    { module: "customer", action: "export_excel", slug: "customer.export_excel" },
    { module: "role_management", action: "view", slug: "role_management.view" },
    { module: "role_management", action: "create", slug: "role_management.create" },
    { module: "role_management", action: "update", slug: "role_management.update" },
    { module: "bundle_product", action: "create", slug: "bundle_product.create" },
    { module: "dashboard", action: "create_admin", slug: "dashboard.create_admin" },
    { module: "product", action: "view", slug: "product.view" },
    { module: "product", action: "create", slug: "product.create" },
    { module: "product", action: "update", slug: "product.update" },
    { module: "product", action: "delete", slug: "product.delete" },
    { module: "product", action: "view_details", slug: "product.view_details" },
    { module: "product", action: "export_pdf", slug: "product.export_pdf" },
    { module: "product", action: "export_excel", slug: "product.export_excel" },
    { module: "create_product", action: "view", slug: "create_product.view" },
    { module: "main_category", action: "view", slug: "main_category.view" },
    { module: "main_category", action: "create", slug: "main_category.create" },
    { module: "main_category", action: "update", slug: "main_category.update" },
    { module: "main_category", action: "delete", slug: "main_category.delete" },
    { module: "main_category", action: "status_update", slug: "main_category.status_update" },
    { module: "category", action: "view", slug: "category.view" },
    { module: "category", action: "create", slug: "category.create" },
    { module: "category", action: "update", slug: "category.update" },
    { module: "category", action: "delete", slug: "category.delete" },
    { module: "sub_category", action: "view", slug: "sub_category.view" },
    { module: "sub_category", action: "create", slug: "sub_category.create" },
    { module: "sub_category", action: "update", slug: "sub_category.update" },
    { module: "sub_category", action: "delete", slug: "sub_category.delete" },
    { module: "brand", action: "view", slug: "brand.view" },
    { module: "brand", action: "create", slug: "brand.create" },
    { module: "brand", action: "update", slug: "brand.update" },
    { module: "brand", action: "delete", slug: "brand.delete" },
  ];

  console.log(`Seeding ${permissionsList.length} permissions...`);
  const createdPermissionIds = [];

  for (const p of permissionsList) {
    const perm = await prisma.permission.upsert({
      where: { slug: p.slug },
      update: {
        module: p.module,
        action: p.action,
      },
      create: {
        module: p.module,
        action: p.action,
        slug: p.slug,
      },
    });
    createdPermissionIds.push(perm.id);
  }

  // Assign all permissions to system_admin role
  for (const permId of createdPermissionIds) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: systemAdminRole.id,
          permissionId: permId,
        },
      },
      update: {},
      create: {
        roleId: systemAdminRole.id,
        permissionId: permId,
      },
    });
  }
  console.log(`✅ All ${createdPermissionIds.length} permissions assigned to system_admin.`);

  // ---------- MAIN CATEGORY ----------
  const mainCategory = await prisma.mainCategory.upsert({
    where: { code: "ELEC" },
    update: {},
    create: {
      code: "ELEC",
      name: "Electronics",
      image:
        "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=500",
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
      image:
        "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500",
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
        image:
          "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500",
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
      images: [
        "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500",
      ],
      description:
        "Flagship smartphone with cutting-edge camera and AI capabilities.",
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
    {
      code: "AH-INC-001",
      title: "Direct Product Sales",
      type: "INCOME",
      description: "Revenue from ekhone orders",
      isSystem: true,
    },
    {
      code: "AH-INC-002",
      title: "Delivery / Shipping Charges Collected",
      type: "INCOME",
      description: "Delivery fees collected",
      isSystem: true,
    },
    {
      code: "AH-EXP-001",
      title: "Digital Marketing & Ads",
      type: "EXPENSE",
      description: "Facebook and Google ads",
      isSystem: true,
    },
    {
      code: "AH-EXP-002",
      title: "Courier Delivery Charges",
      type: "EXPENSE",
      description: "Steadfast and Pathao shipping fees",
      isSystem: true,
    },
    {
      code: "AH-EXP-003",
      title: "Packaging & Supplies",
      type: "EXPENSE",
      description: "Boxes, tape, flyers",
      isSystem: true,
    },
    {
      code: "AH-EXP-004",
      title: "Office Rent & Warehouse",
      type: "EXPENSE",
      description: "Office rental",
      isSystem: false,
    },
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

// app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');


const dashboardSummaryRoutes = require('./routes/dashboardSummaryRoute');
const mainCategoryRoutes = require('./routes/mainCategoryRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const subCategoryRoutes = require('./routes/subCategoryRoutes');
const brandRoutes = require('./routes/brandRoutes');
const unitRoutes = require('./routes/unitRoutes');
const variantAttributeRoutes = require('./routes/variantAttributesRoutes');
const warrantyRoutes = require('./routes/warrantyRoutes');
const productRoutes = require('./routes/productRoutes');
const customerRoutes = require('./routes/customerRoutes');
const orderRoutes = require('./routes/onlineOrderRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const couponRoutes = require('./routes/couponRoutes');
const discountRoutes = require('./routes/discountRoutes');
const paymentRoutes = require('./routes/paymentRoute');
const bundleRoutes = require('./routes/bundleRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const loyaltyPointRoutes = require('./routes/loyaltyPointRoutes');
const emailRoutes = require('./routes/emailRoutes');
const blogRoutes = require('./routes/blogRoutes');
const storeRoutes = require('./routes/storeRoutes');
const contactRoutes = require('./routes/contactRoutes');
const promoRoutes = require('./routes/promoRoutes');
const topPickRoutes = require('./routes/topPickRoutes');
const heroRoutes = require('./routes/heroRoutes');
const heroSliderRoutes = require('./routes/heroSliderRoutes');
const aboutInfoRoutes = require('./routes/aboutUsRoute');
const missionVisionRoutes = require('./routes/missionVisionRoute');
const teamMemberRoutes = require('./routes/teamMemberRoute');
const teamMemberStatusRoutes = require('./routes/teamStatusRoute');
const ourClientRoutes = require('./routes/clientRoute');
const clientStatusRoutes = require('./routes/clientStatusRoute');
const bentoImageGalleryRoutes = require('./routes/bentoImageGalleryRoute');
const midBannerRoutes = require('./routes/midBannerRoute');
const testimonialsRoutes = require('./routes/testimonialsRoute');
const enquiryUsRoutes = require('./routes/enquiryUsRoute');
const collectionRoutes = require('./routes/collectionRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const accountingRoutes = require('./routes/accountingRoutes');
const landingPageRoutes = require('./routes/landingPageRoutes');

const { getAllProductForAdmin } = require("./controllers/productController");
const authRoutes = require('./routes/authRoutes');
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const adminRoutes = require('./routes/adminRoutes');
const rbacRoutes = require('./routes/rbacRoute');
const { authMiddleware } = require("./middlewares/authMiddleware");
const analyticsRoutes = require('./routes/analyticsRoutes');



const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/', (req, res) => res.json({ ok: true, message: 'Ekhone E-commerce server is running powered by Ahmed Siyan' }));



app.use('/api/dashboard', dashboardSummaryRoutes);
app.use('/api/main-categories', mainCategoryRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sub-categories', subCategoryRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/unit', unitRoutes);
app.use('/api/variant-attributes', variantAttributeRoutes);
app.use('/api/warranty', warrantyRoutes);
app.use('/api/products', authMiddleware, getAllProductForAdmin);  //only for admin api
app.use('/api/product', productRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/invoice', invoiceRoutes);
app.use('/api/coupon', couponRoutes);
app.use('/api/discount-campaign', discountRoutes);
app.use('/api/bundle-product', bundleRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/loyalty-points', loyaltyPointRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin-auth', adminAuthRoutes);
app.use('/api/admin-user', adminRoutes);
app.use('/api/rbac', rbacRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/landing-page', landingPageRoutes);

// CMS API
app.use('/api/hero', heroRoutes);
app.use('/api/hero-sliders', heroSliderRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/our-store', storeRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/top-picks', topPickRoutes);
app.use('/api/about-us', aboutInfoRoutes);
app.use('/api/mission-vision', missionVisionRoutes);
app.use('/api/team-member', teamMemberRoutes);
app.use('/api/member-status', teamMemberStatusRoutes);
app.use('/api/our-client', ourClientRoutes);
app.use('/api/client-status', clientStatusRoutes);
app.use('/api/bento-gallery', bentoImageGalleryRoutes);
app.use('/api/mid-banner', midBannerRoutes);
app.use('/api/testimonials', testimonialsRoutes);
app.use('/api/enquiry-us', enquiryUsRoutes);


app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Server error' });
});


module.exports = app;













# Ekhone E-commerce Server

Backend API server for **ekhone.com** e-commerce platform.

# Express Framework

npm install express

# Google Analytics Data API

npm install @google-analytics/data

# Environment Variables

npm install dotenv

# CORS Support

npm install cors

# HTTP Request Logger (Optional)

npm install morgan

# Security Headers (Optional)

npm install helmet

# Full Google Analytics

curl "http://localhost:5000/api/analytics?startDate=7daysAgo&endDate=today"

# Realtime

curl "http://localhost:5000/api/analytics/realtime"

# Specific Metric

curl "http://localhost:5000/api/analytics/metrics?metric=traffic"

### Configure the Google analytics

GA_PROPERTY_ID, GOOGLE_CLIENT_EMAIL, এবং GOOGLE_PRIVATE_KEY — process......।

# 1. GA_PROPERTY_ID (Google Analytics Property ID) GA4 প্রপার্টিকে চিহ্নিত করে ।

Google Analytics-এ লগইন করুন ।

নিচের বাম দিকে Admin (পছন্দসমূহ) গিয়ার আইকনে ক্লিক করুন ।

নিশ্চিত করুন যে সঠিক Account এবং Property নির্বাচন করা আছে।

Property Settings (সম্পত্তির সেটিংস)-এ ক্লিক করুন।

সেটিংস পেজের উপরের দিকে আপনি "Property ID" দেখতে পাবেন—এটি আপনার GA_PROPERTY_ID ।

# 2. GOOGLE_CLIENT_EMAIL ও GOOGLE_PRIVATE_KEY (Service Account Credentials) এই দুটি মান একটি Service Account-এর JSON কী ফাইল থেকে পাওয়া যায়। যদি আপনার কাছে আগে থেকে না থাকে, তাহলে নতুন করে তৈরি করতে হবে।

Google Cloud Console-এ যান (console.cloud.google.com) ।

Service Account তৈরি করুন:

IAM & Admin > Service Accounts-এ যান ।

CREATE SERVICE ACCOUNT-এ ক্লিক করুন, নাম দিন এবং CREATE-এ ক্লিক করুন ।
JSON Key তৈরি ও ডাউনলোড করুন:

তৈরি হওয়া Service Account-এর Actions মেনুতে (তিনটি ডট) ক্লিক করে Manage Keys নির্বাচন করুন ।

ADD KEY > Create New Key > JSON ফরম্যাট নির্বাচন করুন ।

CREATE-তে ক্লিক করলেই একটি JSON ফাইল ডাউনলোড হবে ।

JSON ফাইল থেকে মান সংগ্রহ করুন:

ডাউনলোড করা JSON ফাইলটি নোটপ্যাড বা যেকোনো টেক্সট এডিটরে খুলুন। ফাইলটির কাঠামো দেখতে অনেকটা এই রকম হবে :

json { "type": "service_account", "project_id": "your-project-id", "private_key_id": "...", "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n", "client_email": "your-service-account-name@your-project-id.iam.gserviceaccount.com", "client_id": "...", "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token" } এখান থেকে client_email এবং private_key এর মান কপি করে নিন। private_key এর ভেতরে থাকা \n গুলো গুরুত্বপূর্ণ, সেগুলো ডিলিট করবেন না ।

# 3. Service Account-কে GA-তে অ্যাক্সেস দিন Service Account-এর JSON থেকে পাওয়া client_email-টি ব্যবহার করে :

Google Analytics-এর Admin প্যানেলে ফিরে যান।

Account Access Management বা Property Access Management-এ যান ।

Add users-এ ক্লিক করে Service Account-এর client_email অ্যাড্রেসটি যোগ করুন এবং তাকে কমপক্ষে Viewer পারমিশন দিন ।

এই তিনটি ধাপ শেষ করলেই আপনার কাছে API-তে ব্যবহারের জন্য প্রয়োজনীয় সব মান চলে আসবে।

- Ahmed Siyan - v8

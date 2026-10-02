// src/services/googleAnalyticsService.js
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

// Environment Variables
const propertyId = process.env.GA_PROPERTY_ID;
const credentials = {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

const analyticsDataClient = new BetaAnalyticsDataClient({ credentials });

// 1. Basic Analytics Data
const getAnalyticsData = async (dateRange) => {
    try {
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
            metrics: [
                { name: 'activeUsers' },
                { name: 'screenPageViews' },
                { name: 'bounceRate' },
                { name: 'averageSessionDuration' },
                { name: 'eventCount' },
                { name: 'keyEvents' },
                { name: 'newUsers' },
            ],
        });

        const row = response?.rows?.[0];
        return {
            activeUsers: parseInt(row?.metricValues?.[0]?.value || '0'),
            totalPageViews: parseInt(row?.metricValues?.[1]?.value || '0'),
            bounceRate: parseFloat(row?.metricValues?.[2]?.value || '0'),
            avgSessionDuration: parseFloat(row?.metricValues?.[3]?.value || '0'),
            eventCount: parseInt(row?.metricValues?.[4]?.value || '0'),
            keyEvents: parseInt(row?.metricValues?.[5]?.value || '0'),
            newUsers: parseInt(row?.metricValues?.[6]?.value || '0'),
        };
    } catch (error) {
        console.error('Error fetching analytics data:', error);
        return null;
    }
};

// 2. Time Series Data
const getTimeSeriesData = async (dateRange) => {
    try {
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
            dimensions: [{ name: 'date' }],
            metrics: [
                { name: 'activeUsers' },
                { name: 'screenPageViews' },
            ],
        });

        return response?.rows?.map((row) => ({
            date: row.dimensionValues?.[0]?.value || '',
            visitors: parseInt(row.metricValues?.[0]?.value || '0'),
            pageViews: parseInt(row.metricValues?.[1]?.value || '0'),
        })) || [];
    } catch (error) {
        console.error('Error fetching time series data:', error);
        return [];
    }
};

// 3. Active Users Per Minute (Realtime)
const getActiveUsersPerMinute = async () => {
    try {
        const [response] = await analyticsDataClient.runRealtimeReport({
            property: `properties/${propertyId}`,
            metrics: [{ name: 'activeUsers' }],
            dimensions: [{ name: 'minutesAgo' }],
            limit: 10,
        });

        return response?.rows?.map((row) => ({
            time: `${row.dimensionValues?.[0]?.value || '0'}m ago`,
            users: parseInt(row.metricValues?.[0]?.value || '0'),
        })).reverse() || [];
    } catch (error) {
        console.error('Error fetching realtime data:', error);
        return [];
    }
};

// 4. Visitors by Country
const getVisitorsByCountry = async (dateRange) => {
    try {
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
            dimensions: [{ name: 'country' }],
            metrics: [{ name: 'activeUsers' }],
            orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
            limit: 10,
        });

        return response?.rows?.map((row) => ({
            country: row.dimensionValues?.[0]?.value || 'Unknown',
            visitors: parseInt(row.metricValues?.[0]?.value || '0'),
        })) || [];
    } catch (error) {
        console.error('Error fetching country data:', error);
        return [];
    }
};

// 5. Traffic Sources
const getTrafficSources = async (dateRange) => {
    try {
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
            dimensions: [{ name: 'sessionSourceMedium' }],
            metrics: [
                { name: 'activeUsers' },
                { name: 'sessions' },
            ],
            orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
            limit: 10,
        });

        return response?.rows?.map((row) => ({
            source: row.dimensionValues?.[0]?.value || 'Direct',
            visitors: parseInt(row.metricValues?.[0]?.value || '0'),
            sessions: parseInt(row.metricValues?.[1]?.value || '0'),
        })) || [];
    } catch (error) {
        console.error('Error fetching traffic sources:', error);
        return [];
    }
};

// 6. Events by Name
const getEventsByName = async (dateRange) => {
    try {
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
            dimensions: [{ name: 'eventName' }],
            metrics: [{ name: 'eventCount' }],
            orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
            limit: 10,
        });

        return response?.rows?.map((row) => ({
            eventName: row.dimensionValues?.[0]?.value || 'Unknown',
            eventCount: parseInt(row.metricValues?.[0]?.value || '0'),
        })) || [];
    } catch (error) {
        console.error('Error fetching events:', error);
        return [];
    }
};

// 7. Events by Platform
const getEventsByPlatform = async (dateRange) => {
    try {
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
            dimensions: [{ name: 'platform' }],
            metrics: [{ name: 'eventCount' }],
        });

        return response?.rows?.map((row) => ({
            platform: row.dimensionValues?.[0]?.value || 'Unknown',
            eventCount: parseInt(row.metricValues?.[0]?.value || '0'),
        })) || [];
    } catch (error) {
        console.error('Error fetching platform events:', error);
        return [];
    }
};

// 8. Top Pages
const getTopPages = async (dateRange) => {
    try {
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
            dimensions: [{ name: 'pageTitle' }],
            metrics: [
                { name: 'screenPageViews' },
                { name: 'averageSessionDuration' },
                { name: 'bounceRate' },
            ],
            orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
            limit: 10,
        });

        return response?.rows?.map((row) => ({
            page: row.dimensionValues?.[0]?.value || 'Home',
            pageViews: parseInt(row.metricValues?.[0]?.value || '0'),
            avgTimeOnPage: parseFloat(row.metricValues?.[1]?.value || '0'),
            bounceRate: parseFloat(row.metricValues?.[2]?.value || '0') * 100,
        })) || [];
    } catch (error) {
        console.error('Error fetching top pages:', error);
        return [];
    }
};

module.exports = {
    getAnalyticsData,
    getTimeSeriesData,
    getActiveUsersPerMinute,
    getVisitorsByCountry,
    getTrafficSources,
    getEventsByName,
    getEventsByPlatform,
    getTopPages,
};
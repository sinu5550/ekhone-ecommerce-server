// src/controllers/analyticsController.js
const analyticsService = require('../services/googleAnalyticsService');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// ************ Get All Analytics Data ******************
const getAnalytics = async (req, res) => {
    try {
        const { startDate = '7daysAgo', endDate = 'today' } = req.query;
        const dateRange = { startDate, endDate };

        const [
            analytics,
            timeSeries,
            realtime,
            countries,
            traffic,
            events,
            platforms,
            pages,
        ] = await Promise.all([
            analyticsService.getAnalyticsData(dateRange),
            analyticsService.getTimeSeriesData(dateRange),
            analyticsService.getActiveUsersPerMinute(),
            analyticsService.getVisitorsByCountry(dateRange),
            analyticsService.getTrafficSources(dateRange),
            analyticsService.getEventsByName(dateRange),
            analyticsService.getEventsByPlatform(dateRange),
            analyticsService.getTopPages(dateRange),
        ]);

        const responseData = {
            totalVisitors: analytics?.activeUsers || 0,
            totalPageViews: analytics?.totalPageViews || 0,
            bounceRate: analytics?.bounceRate || 0,
            avgSessionDuration: analytics?.avgSessionDuration || 0,
            activeUsers: analytics?.activeUsers || 0,
            eventCount: analytics?.eventCount || 0,
            keyEvents: analytics?.keyEvents || 0,
            newUsers: analytics?.newUsers || 0,
            pageViewsOverTime: timeSeries || [],
            activeUsersPerMinute: realtime || [],
            visitorsByCountry: countries || [],
            trafficSources: traffic || [],
            eventsByName: events || [],
            eventsByPlatform: platforms || [],
            topPages: pages || [],
        };

        return successResponse(res, 'Analytics data fetched successfully', responseData);
    } catch (error) {
        console.error('Analytics API Error:', error);
        return errorResponse(res, error.message || 'Failed to fetch analytics data', 500);
    }
};

// ************ Get Realtime Analytics Data ******************
const getRealtimeAnalytics = async (req, res) => {
    try {
        const [realtime, analytics] = await Promise.all([
            analyticsService.getActiveUsersPerMinute(),
            analyticsService.getAnalyticsData({ startDate: 'today', endDate: 'today' }),
        ]);

        const responseData = {
            activeUsers: analytics?.activeUsers || 0,
            activeUsersPerMinute: realtime || [],
            eventCount: analytics?.eventCount || 0,
            timestamp: new Date().toISOString(),
        };

        return successResponse(res, 'Realtime data fetched successfully', responseData);
    } catch (error) {
        console.error('Realtime API Error:', error);
        return errorResponse(res, error.message || 'Failed to fetch realtime data', 500);
    }
};

// ************ Get Specific Metric Data ******************
const getMetricData = async (req, res) => {
    try {
        const { metric } = req.query;
        const { startDate = '7daysAgo', endDate = 'today' } = req.query;
        const dateRange = { startDate, endDate };

        let data = {};
        let metricName = '';

        switch (metric) {
            case 'countries':
                data = await analyticsService.getVisitorsByCountry(dateRange);
                metricName = 'visitorsByCountry';
                break;
            case 'traffic':
                data = await analyticsService.getTrafficSources(dateRange);
                metricName = 'trafficSources';
                break;
            case 'events':
                data = await analyticsService.getEventsByName(dateRange);
                metricName = 'eventsByName';
                break;
            case 'pages':
                data = await analyticsService.getTopPages(dateRange);
                metricName = 'topPages';
                break;
            default:
                return errorResponse(res, 'Invalid metric parameter. Available: countries, traffic, events, pages', 400);
        }

        const responseData = {
            [metricName]: data || [],
            timestamp: new Date().toISOString(),
            dateRange,
        };

        return successResponse(res, `${metric} data fetched successfully`, responseData);
    } catch (error) {
        console.error('Metrics API Error:', error);
        return errorResponse(res, error.message || 'Failed to fetch metrics data', 500);
    }
};

module.exports = {
    getAnalytics,
    getRealtimeAnalytics,
    getMetricData,
};
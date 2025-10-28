class RevenueAnalytics {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.filters = {
            timeRange: 'Last 12 months',
            taxType: 'All Taxes'
        };
    }

    async loadRevenueBreakdown() {
        try {
            const response = await fetch('/api/analytics/revenue-data');
            const data = await response.json();

            if (data.error) throw new Error(data.error);

            this.createRevenueBreakdownChart(data);
        } catch (error) {
            console.error('Error loading revenue breakdown:', error);
        }
    }

    createRevenueBreakdownChart(data) {
        const taxTypes = Object.keys(data.forecast_chart.tax_breakdown);
        const latestValues = taxTypes.map(taxType => 
            data.forecast_chart.tax_breakdown[taxType].slice(-1)[0]
        );

        const pieTrace = {
            labels: taxTypes.map(type => type.replace('_', ' ')),
            values: latestValues,
            type: 'pie',
            hole: 0.4,
            textinfo: 'label+percent',
            hoverinfo: 'label+value+percent',
            textposition: 'outside',
            marker: {
                colors: ['#2E86AB', '#A23B72', '#F18F01', '#C73E1D']
            }
        };

        const layout = {
            title: 'Current Revenue Distribution by Tax Type',
            showlegend: true,
            legend: {
                orientation: 'v',
                y: 0.5
            },
            margin: { t: 50, r: 50, b: 50, l: 50 }
        };

        Plotly.newPlot('revenue-breakdown-chart', [pieTrace], layout, {
            responsive: true,
            displayModeBar: true
        });
    }

    async exportAnalyticsData() {
        try {
            const response = await fetch('/api/analytics/revenue-data');
            const data = await response.json();

            if (data.error) throw new Error(data.error);

            // Convert to CSV and download
            this.downloadCSV(data, 'revenue_analytics_export.csv');
            
        } catch (error) {
            console.error('Error exporting analytics data:', error);
            this.dashboard.showError('Failed to export data');
        }
    }

    downloadCSV(data, filename) {
        // Implementation for CSV export
        console.log('Exporting data as CSV:', filename, data);
        // In a real implementation, this would convert data to CSV and trigger download
        alert(`Export functionality would download: ${filename}`);
    }
}
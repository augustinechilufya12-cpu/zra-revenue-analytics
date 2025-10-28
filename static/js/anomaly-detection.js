class AnomalyDetection {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }

    async loadAnomalyTrends() {
        try {
            const response = await fetch('/api/anomalies/detections');
            const data = await response.json();

            if (data.error) throw new Error(data.error);

            this.createAnomalyTrendChart(data.anomalies);
        } catch (error) {
            console.error('Error loading anomaly trends:', error);
        }
    }

    createAnomalyTrendChart(anomalies) {
        if (!anomalies || anomalies.length === 0) return;

        // Group anomalies by month and severity
        const monthlyData = {};
        
        anomalies.forEach(anomaly => {
            const month = anomaly.date.substring(0, 7); // YYYY-MM
            if (!monthlyData[month]) {
                monthlyData[month] = { high: 0, medium: 0, low: 0 };
            }
            monthlyData[month][anomaly.severity]++;
        });

        const months = Object.keys(monthlyData).sort();
        const highCounts = months.map(month => monthlyData[month].high);
        const mediumCounts = months.map(month => monthlyData[month].medium);
        const lowCounts = months.map(month => monthlyData[month].low);

        const highTrace = {
            x: months,
            y: highCounts,
            type: 'bar',
            name: 'High Severity',
            marker: { color: '#C73E1D' }
        };

        const mediumTrace = {
            x: months,
            y: mediumCounts,
            type: 'bar',
            name: 'Medium Severity',
            marker: { color: '#F18F01' }
        };

        const lowTrace = {
            x: months,
            y: lowCounts,
            type: 'bar',
            name: 'Low Severity',
            marker: { color: '#2E86AB' }
        };

        const layout = {
            title: 'Anomaly Trends Over Time',
            xaxis: { title: 'Month' },
            yaxis: { title: 'Number of Anomalies' },
            barmode: 'stack',
            hovermode: 'closest'
        };

        Plotly.newPlot('anomaly-trend-chart', [highTrace, mediumTrace, lowTrace], layout, {
            responsive: true,
            displayModeBar: true
        });
    }
}
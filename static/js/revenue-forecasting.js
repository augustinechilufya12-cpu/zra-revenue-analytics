class RevenueForecasting {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.currentForecast = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Forecast generation
        document.getElementById('run-forecast').addEventListener('click', () => {
            this.generateForecast();
        });

        // Export functionality
        document.getElementById('export-forecast').addEventListener('click', () => {
            this.exportForecastData();
        });
    }

    async generateForecast() {
        try {
            this.dashboard.showLoading('Generating revenue forecast...');
            
            const response = await fetch('/api/forecast/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            this.currentForecast = data;
            this.createForecastChart(data.forecasts);
            this.createHeatmap(data.forecasts);
            this.updateForecastSummary(data.summary);
            
            this.dashboard.showSuccess('Forecast generated successfully!');
            
        } catch (error) {
            console.error('Error generating forecast:', error);
            this.dashboard.showError(error.message || 'Failed to generate forecast');
        }
    }

    createForecastChart(forecasts) {
        const dates = forecasts.Total_Revenue.dates;
        
        const traces = Object.keys(forecasts).map(taxType => {
            return {
                x: dates,
                y: forecasts[taxType].values,
                name: taxType.replace('_', ' '),
                type: 'line',
                mode: 'lines+markers',
                hovertemplate: ${taxType.replace('_', ' ')}: %{y:,.0f}<extra></extra>
            };
        });

        const layout = {
            title: '12-Month Revenue Forecast by Tax Type',
            xaxis: {
                title: 'Month',
                type: 'date',
                tickformat: '%b %Y'
            },
            yaxis: {
                title: 'Revenue (ZMW)',
                tickformat: ',.0f'
            },
            hovermode: 'closest',
            showlegend: true,
            legend: {
                orientation: 'h',
                y: -0.2
            },
            margin: { t: 50, r: 50, b: 100, l: 80 }
        };

        Plotly.newPlot('revenue-forecast-chart', traces, layout, {
            responsive: true,
            displayModeBar: true
        });
    }

    createHeatmap(forecasts) {
        // Remove Total_Revenue from heatmap
        const taxTypes = Object.keys(forecasts).filter(type => type !== 'Total_Revenue');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const z = [];
        const text = [];
        
        taxTypes.forEach(taxType => {
            const values = forecasts[taxType].values;
            z.push(values);
            
            const rowText = values.map((value, i) => 
                ${taxType.replace('_', ' ')}<br>${months[i]}<br>ZMW ${value.toLocaleString()}
            );
            text.push(rowText);
        });

        const trace = {
            z: z,
            x: months,
            y: taxTypes.map(type => type.replace('_', ' ')),
            type: 'heatmap',
            colorscale: 'Viridis',
            hoverinfo: 'text',
            text: text,
            hoverlabel: {
                bgcolor: 'white',
                bordercolor: 'black',
                font: { color: 'black' }
            }
        };

        const layout = {
            title: 'Monthly Revenue Distribution Forecast',
            xaxis: { title: 'Month' },
            yaxis: { title: 'Tax Type' },
            margin: { t: 50, r: 50, b: 50, l: 120 }
        };

        Plotly.newPlot('revenue-heatmap', [trace], layout, {
            responsive: true,
            displayModeBar: true
        });
    }

    updateForecastSummary(summary) {
        const tableContainer = document.getElementById('forecast-summary-table');
        
        if (!summary || summary.length === 0) {
            tableContainer.innerHTML = '<div class="no-data">No summary data available</div>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'performance-table';
        
        // Create header
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Tax Type</th>
                <th>Total Forecast</th>
                <th>Avg Monthly</th>
                <th>Growth Rate</th>
            </tr>
        `;
        
        // Create body
        const tbody = document.createElement('tbody');
        summary.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.tax_type}</td>
                <td>ZMW ${item.total_forecast.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                <td>ZMW ${item.average_monthly.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                <td class="${item.growth_rate >= 0 ? 'positive' : 'negative'}">
                    ${item.growth_rate >= 0 ? '+' : ''}${item.growth_rate.toFixed(1)}%
                </td>
            `;
            tbody.appendChild(row);
        });
        
        table.appendChild(thead);
        table.appendChild(tbody);
        tableContainer.innerHTML = '';
        tableContainer.appendChild(table);
    }

    async exportForecastData() {
        if (!this.currentForecast) {
            this.dashboard.showError('No forecast data to export. Please generate a forecast first.');
            return;
        }

        try {
            const response = await fetch('/api/forecast/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    forecasts: this.currentForecast.forecasts
                })
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            // Download CSV
            const blob = new Blob([data.csv_data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = data.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.dashboard.showSuccess('Forecast exported successfully!');
            
        } catch (error) {
            console.error('Error exporting forecast:', error);
            this.dashboard.showError(error.message || 'Failed to export forecast data');
        }
    }
}

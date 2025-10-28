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
            // Convert values from millions to proper display format
            const valuesInMillions = forecasts[taxType].values.map(value => value); // Values are already in millions
            
            return {
                x: dates,
                y: valuesInMillions,
                name: this.formatTaxTypeName(taxType),
                type: 'line',
                mode: 'lines+markers',
                hovertemplate: `${this.formatTaxTypeName(taxType)}: ZMW %{y:.3f}M<extra></extra>`
            };
        });

        const layout = {
            title: {
                text: '12-Month Revenue Forecast by Tax Type',
                font: { size: 16, weight: 'bold' }
            },
            xaxis: {
                title: {
                    text: 'Month',
                    font: { size: 12, weight: 'bold' }
                },
                type: 'date',
                tickformat: '%b %Y',
                tickangle: -45,
                tickfont: { size: 10 },
                gridcolor: '#f0f0f0',
                showgrid: true
            },
            yaxis: {
                title: {
                    text: 'Revenue (ZMW Millions)',
                    font: { size: 12, weight: 'bold' }
                },
                tickformat: ',.0f',
                tickprefix: 'ZMW ',
                ticksuffix: 'M',
                tickfont: { size: 10 },
                gridcolor: '#f0f0f0',
                showgrid: true,
                rangemode: 'tozero'
            },
            hovermode: 'closest',
            showlegend: true,
            legend: {
                orientation: 'h',
                y: -0.3,
                x: 0.5,
                xanchor: 'center',
                font: { size: 10 }
            },
            margin: { t: 60, r: 40, b: 100, l: 80 },
            plot_bgcolor: 'white',
            paper_bgcolor: 'white'
        };

        const config = {
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            toImageButtonOptions: {
                format: 'png',
                filename: 'revenue_forecast',
                height: 500,
                width: 800,
                scale: 2
            }
        };

        Plotly.newPlot('revenue-forecast-chart', traces, layout, config);
    }

    // Helper method to format tax type names
    formatTaxTypeName(taxType) {
        const nameMap = {
            'Total_Revenue': 'Total Revenue',
            'Corporate_Tax': 'Corporate Tax',
            'Customs_Duties': 'Customs Duties',
            'Excise_Tax': 'Excise Tax',
            'Mineral_Royalty': 'Mineral Royalty',
            'PAYE': 'PAYE',
            'VAT': 'VAT'
        };
        return nameMap[taxType] || taxType.replace('_', ' ');
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
                `${this.formatTaxTypeName(taxType)}<br>${months[i]}<br>ZMW ${value.toFixed(3)}M`
            );
            text.push(rowText);
        });

        const trace = {
            z: z,
            x: months,
            y: taxTypes.map(type => this.formatTaxTypeName(type)),
            type: 'heatmap',
            colorscale: 'Viridis',
            hoverinfo: 'text',
            text: text,
            hoverlabel: {
                bgcolor: 'white',
                bordercolor: 'black',
                font: { color: 'black', size: 10 }
            }
        };

        const layout = {
            title: {
                text: 'Monthly Revenue Distribution Forecast (ZMW Millions)',
                font: { size: 14, weight: 'bold' }
            },
            xaxis: { 
                title: 'Month',
                tickangle: 0
            },
            yaxis: { 
                title: 'Tax Type',
                tickfont: { size: 10 }
            },
            margin: { t: 60, r: 50, b: 50, l: 120 }
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
                <th>Total Forecast (ZMW M)</th>
                <th>Avg Monthly (ZMW M)</th>
                <th>Growth Rate</th>
            </tr>
        `;
        
        // Create body
        const tbody = document.createElement('tbody');
        summary.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.tax_type}</td>
                <td>${(item.total_forecast).toFixed(3)}</td>
                <td>${item.average_monthly.toFixed(3)}</td>
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

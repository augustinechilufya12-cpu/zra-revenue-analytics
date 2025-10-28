class RevenueDashboard {
    constructor() {
        this.currentPage = 'dashboard-overview';
        this.currentForecast = null;
        this.anomalyThreshold = 0.15; // 15% deviation threshold
        this.init();
    }

    init() {
        console.log('📊 Initializing ZRA Revenue Analytics Dashboard...');
        this.setupEventListeners();
        this.checkAuth();
        this.loadDashboardData();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchPage(e.target.closest('.nav-link').dataset.page);
            });
        });

        // Sidebar toggle
        document.querySelector('.sidebar-toggle').addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('collapsed');
        });

        // KPI card clicks - UPDATED to navigate to revenue-forecasting
        document.querySelectorAll('.clickable-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const targetPage = e.currentTarget.dataset.target;
                // Redirect both growth rate and total revenue cards to revenue-forecasting
                if (targetPage === 'revenue-analytics' || targetPage === 'revenue-forecasting') {
                    this.switchPage('revenue-forecasting');
                } else {
                    this.switchPage(targetPage);
                }
            });
        });

        // Revenue Forecasting controls
        const runForecastBtn = document.getElementById('run-forecast');
        const exportForecastBtn = document.getElementById('export-forecast');

        if (runForecastBtn) {
            runForecastBtn.addEventListener('click', () => {
                this.generateForecast();
            });
        }

        if (exportForecastBtn) {
            exportForecastBtn.addEventListener('click', () => {
                this.exportForecastData();
            });
        }

        // Scenario planning controls
        const vatSlider = document.getElementById('vat-slider');
        const corpTaxSlider = document.getElementById('corp-tax-slider');
        const incomeTaxSlider = document.getElementById('income-tax-slider');
        const runSimulationBtn = document.getElementById('run-simulation');

        if (vatSlider) {
            vatSlider.addEventListener('input', (e) => {
                document.getElementById('vat-value').textContent = e.target.value + '%';
                this.updateScenarioImpactPreview();
            });
        }

        if (corpTaxSlider) {
            corpTaxSlider.addEventListener('input', (e) => {
                document.getElementById('corp-tax-value').textContent = e.target.value + '%';
                this.updateScenarioImpactPreview();
            });
        }

        if (incomeTaxSlider) {
            incomeTaxSlider.addEventListener('input', (e) => {
                document.getElementById('income-tax-value').textContent = e.target.value + '%';
                this.updateScenarioImpactPreview();
            });
        }

        if (runSimulationBtn) {
            runSimulationBtn.addEventListener('click', () => {
                this.runScenarioSimulation();
            });
        }

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });
    }

    async checkAuth() {
        try {
            const response = await fetch('/api/check-auth');
            const data = await response.json();
            
            if (!data.authenticated) {
                window.location.href = '/';
                return;
            }
            
            if (data.user) {
                document.getElementById('user-display').textContent = data.user;
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/';
        }
    }

    async handleLogout() {
        try {
            await fetch('/api/logout');
            window.location.href = '/';
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }

    switchPage(pageId) {
        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-page="${pageId}"]`).classList.add('active');

        // Update page content
        document.querySelectorAll('.content-page').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(pageId).classList.add('active');

        // Update page title
        const pageTitle = document.getElementById('page-title');
        const pageHeaders = {
            'dashboard-overview': 'Dashboard Overview',
            'revenue-forecasting': 'Revenue Forecasting',
            'anomaly-detection': 'Anomaly Detection',
            'scenario-planning': 'Scenario Planning',
            'reports': 'Reports & Insights',
            'admin': 'Admin Settings'
        };
        pageTitle.textContent = pageHeaders[pageId] || 'Dashboard';

        this.currentPage = pageId;
        this.loadPageSpecificData();
    }

    async loadDashboardData() {
        await this.loadKPIs();
        await this.loadRevenueForecastChart();
        await this.loadRevenueVsForecastChart(); // NEW: Load the revenue vs forecast chart
        await this.loadRecentAlerts();
    }

    async loadKPIs() {
        try {
            const response = await fetch('/api/dashboard/kpis');
            const kpiData = await response.json();

            if (kpiData.error) {
                throw new Error(kpiData.error);
            }

            // Update KPI cards with dashboard data
            this.updateKPICard('total-revenue-value', kpiData.total_revenue.value);
            this.updateKPICard('growth-rate-value', kpiData.growth_rate.value);
            this.updateKPICard('anomalies-value', kpiData.anomalies.value);

            // Update trends
            this.updateTrend('revenue-trend', kpiData.total_revenue.trend, kpiData.total_revenue.trend_value);
            this.updateTrend('growth-trend', kpiData.growth_rate.trend, kpiData.growth_rate.trend_value);
            this.updateTrend('anomalies-trend', kpiData.anomalies.trend, kpiData.anomalies.trend_value);

            // NEW: Load forecast summary for growth rate display
            await this.loadForecastGrowthRate();

        } catch (error) {
            console.error('Error loading KPIs:', error);
            this.showError('Failed to load dashboard KPIs');
        }
    }

    async loadForecastGrowthRate() {
        try {
            // Generate forecast to get the latest growth rate
            const response = await fetch('/api/forecast/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const forecastData = await response.json();

            if (forecastData.error) {
                throw new Error(forecastData.error);
            }

            // Find Total Revenue growth rate from forecast summary
            if (forecastData.summary) {
                const totalRevenueSummary = forecastData.summary.find(item => 
                    item.tax_type.toLowerCase().includes('total revenue')
                );
                
                if (totalRevenueSummary) {
                    // Update the growth rate KPI card with forecast data
                    const growthRateElement = document.getElementById('growth-rate-value');
                    const growthTrendElement = document.getElementById('growth-trend');
                    
                    if (growthRateElement) {
                        growthRateElement.textContent = `${totalRevenueSummary.growth_rate.toFixed(1)}%`;
                    }
                    
                    if (growthTrendElement) {
                        const trend = totalRevenueSummary.growth_rate >= 0 ? 'positive' : 'negative';
                        const trendIcon = totalRevenueSummary.growth_rate >= 0 ? 'up' : 'down';
                        growthTrendElement.className = `kpi-trend ${trend}`;
                        growthTrendElement.innerHTML = `<i class="fas fa-arrow-${trendIcon}"></i> ${Math.abs(totalRevenueSummary.growth_rate).toFixed(1)}%`;
                    }

                    // Store the current forecast for later use
                    this.currentForecast = forecastData;
                }
            }

        } catch (error) {
            console.error('Error loading forecast growth rate:', error);
            // Fallback to using the dashboard KPI data
        }
    }

    updateKPICard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    updateTrend(elementId, trend, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.className = `kpi-trend ${trend}`;
            element.innerHTML = `<i class="fas fa-arrow-${trend === 'positive' ? 'up' : 'down'}"></i> ${value}`;
        }
    }

    async loadRevenueVsForecastChart() {
        try {
            const response = await fetch('/api/dashboard/revenue-vs-forecast');
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            this.createRevenueVsForecastChart(data);

        } catch (error) {
            console.error('Error loading revenue vs forecast chart:', error);
            const chartElement = document.getElementById('revenue-forecast-chart-2');
            if (chartElement) {
                chartElement.innerHTML = 
                    '<div class="chart-error">Failed to load revenue vs forecast data.</div>';
            }
        }
    }

    createRevenueVsForecastChart(data) {
        const traces = [];

        // Add actual revenue line
        if (data.actual && data.actual.length > 0) {
            traces.push({
                x: data.dates,
                y: data.actual,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Actual Revenue',
                line: { 
                    color: '#2E86AB', 
                    width: 3 
                },
                marker: { 
                    size: 6,
                    symbol: 'circle'
                }
            });
        }

        // Add predicted revenue line
        if (data.predicted && data.predicted.length > 0) {
            traces.push({
                x: data.dates,
                y: data.predicted,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Predicted Revenue',
                line: { 
                    color: '#A23B72', 
                    width: 3,
                    dash: 'dash'
                },
                marker: { 
                    size: 6,
                    symbol: 'diamond'
                }
            });
        }

        // Add deviation area if available
        if (data.actual && data.predicted && data.actual.length === data.predicted.length) {
            const deviations = data.actual.map((actual, index) => {
                const predicted = data.predicted[index];
                return Math.abs(actual - predicted) / actual * 100;
            });

            traces.push({
                x: data.dates,
                y: deviations,
                type: 'scatter',
                mode: 'lines',
                name: 'Deviation %',
                line: { 
                    color: '#F18F01', 
                    width: 2 
                },
                yaxis: 'y2',
                fill: 'tozeroy',
                fillcolor: 'rgba(241, 143, 1, 0.1)'
            });
        }

        const layout = {
            title: {
                text: 'Revenue vs Forecast Performance',
                font: { size: 16, color: '#2C3E50' }
            },
            xaxis: {
                title: {
                    text: 'Date',
                    font: { size: 12, color: '#7F8C8D' }
                },
                type: 'date',
                tickformat: '%b %Y',
                gridcolor: '#ECF0F1',
                tickangle: -45
            },
            yaxis: {
                title: {
                    text: 'Revenue (ZMW)',
                    font: { size: 12, color: '#7F8C8D' }
                },
                tickformat: ',.0f',
                gridcolor: '#ECF0F1',
                zerolinecolor: '#BDC3C7'
            },
            yaxis2: {
                title: {
                    text: 'Deviation %',
                    font: { size: 12, color: '#F18F01' }
                },
                overlaying: 'y',
                side: 'right',
                gridcolor: 'rgba(0,0,0,0)',
                range: [0, 50] // 0-50% deviation range
            },
            hovermode: 'closest',
            showlegend: true,
            legend: {
                orientation: 'h',
                y: -0.3,
                x: 0.1,
                bgcolor: 'rgba(255,255,255,0.8)',
                bordercolor: '#BDC3C7',
                borderwidth: 1
            },
            margin: { t: 60, r: 80, b: 80, l: 80 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { family: 'Segoe UI, sans-serif' }
        };

        const config = {
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            toImageButtonOptions: {
                format: 'png',
                filename: 'zra_revenue_vs_forecast',
                height: 400,
                width: 800,
                scale: 2
            }
        };

        const chartElement = document.getElementById('revenue-forecast-chart-2');
        if (chartElement) {
            Plotly.newPlot('revenue-forecast-chart-2', traces, layout, config);
        }
    }

    async loadRevenueForecastChart() {
        try {
            const response = await fetch('/api/dashboard/revenue-forecast');
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            // Create traces for each tax type
            const traces = [
                {
                    x: data.dates,
                    y: data.Total_Revenue,
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: 'Total Revenue',
                    line: { color: '#2E86AB', width: 4 },
                    marker: { size: 6 }
                },
                {
                    x: data.dates,
                    y: data.VAT,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'VAT Revenue',
                    line: { color: '#A23B72', width: 2, dash: 'dot' }
                },
                {
                    x: data.dates,
                    y: data.Income_Tax,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Income Tax Revenue',
                    line: { color: '#F18F01', width: 2, dash: 'dash' }
                },
                {
                    x: data.dates,
                    y: data.Customs_Duties,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Customs Duties Revenue',
                    line: { color: '#C73E1D', width: 2, dash: 'dashdot' }
                }
            ];

            const layout = {
                title: {
                    text: 'ZRA Revenue Forecast Analysis',
                    font: { size: 18, color: '#2C3E50' }
                },
                xaxis: {
                    title: {
                        text: 'Forecast Period',
                        font: { size: 12, color: '#7F8C8D' }
                    },
                    type: 'date',
                    tickformat: '%b %Y',
                    gridcolor: '#ECF0F1',
                    tickangle: -45
                },
                yaxis: {
                    title: {
                        text: 'Revenue (ZMW)',
                        font: { size: 12, color: '#7F8C8D' }
                    },
                    tickformat: ',.0f',
                    gridcolor: '#ECF0F1',
                    zerolinecolor: '#BDC3C7'
                },
                hovermode: 'closest',
                showlegend: true,
                legend: {
                    orientation: 'h',
                    y: -0.3,
                    x: 0.1,
                    bgcolor: 'rgba(255,255,255,0.8)',
                    bordercolor: '#BDC3C7',
                    borderwidth: 1
                },
                margin: { t: 60, r: 40, b: 80, l: 80 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { family: 'Segoe UI, sans-serif' }
            };

            const config = {
                responsive: true,
                displayModeBar: true,
                displaylogo: false,
                modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
                toImageButtonOptions: {
                    format: 'png',
                    filename: 'zra_revenue_forecast',
                    height: 500,
                    width: 800,
                    scale: 2
                }
            };

            // Plot in the main dashboard chart container
            const chartElement = document.getElementById('revenue-forecast-chart');
            if (chartElement) {
                Plotly.newPlot('revenue-forecast-chart', traces, layout, config);
            }

        } catch (error) {
            console.error('Error loading revenue chart:', error);
            const chartElement = document.getElementById('revenue-forecast-chart');
            if (chartElement) {
                chartElement.innerHTML = 
                    '<div class="chart-error">Failed to load revenue forecast data. Please check your data connection.</div>';
            }
        }
    }

    async loadRecentAlerts() {
        try {
            const response = await fetch('/api/anomalies/detections');
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            const alertsContainer = document.getElementById('recent-alerts');
            if (data.anomalies && data.anomalies.length > 0) {
                const recentAnomalies = data.anomalies
                    .filter(anomaly => anomaly.severity === 'high' || anomaly.severity === 'medium')
                    .slice(0, 5);
                
                if (recentAnomalies.length > 0) {
                    alertsContainer.innerHTML = recentAnomalies.map(anomaly => `
                        <div class="alert-item ${anomaly.severity} clickable-alert" 
                             data-anomaly-id="${anomaly.id || anomaly.date + '-' + anomaly.tax_type}"
                             data-tax-type="${anomaly.tax_type}"
                             data-date="${anomaly.date}"
                             data-severity="${anomaly.severity}">
                            <i class="fas ${this.getAlertIcon(anomaly.severity)}"></i>
                            <div class="alert-content">
                                <strong>${anomaly.tax_type} Anomaly - ${anomaly.region || 'National'}</strong>
                                <small>Date: ${anomaly.date} | Deviation: ${anomaly.deviation}</small>
                                <small>Click to investigate</small>
                            </div>
                        </div>
                    `).join('');

                    // Add click event listeners to alerts
                    this.setupAlertClickHandlers();
                } else {
                    alertsContainer.innerHTML = `
                        <div class="alert-item success">
                            <i class="fas fa-check-circle"></i>
                            <span>No critical alerts in recent period</span>
                        </div>
                    `;
                }
            } else {
                alertsContainer.innerHTML = `
                    <div class="alert-item success">
                        <i class="fas fa-check-circle"></i>
                        <span>No anomaly alerts detected</span>
                    </div>
                `;
            }

        } catch (error) {
            console.error('Error loading alerts:', error);
            document.getElementById('recent-alerts').innerHTML = 
                '<div class="alert-item error">Failed to load alert data</div>';
        }
    }

    getAlertIcon(severity) {
        switch (severity) {
            case 'high': return 'fa-exclamation-triangle';
            case 'medium': return 'fa-exclamation-circle';
            case 'low': return 'fa-info-circle';
            default: return 'fa-bell';
        }
    }

    setupAlertClickHandlers() {
        document.querySelectorAll('.clickable-alert').forEach(alert => {
            alert.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleAlertClick(alert);
            });
            
            // Add hover effects via JavaScript
            alert.style.cursor = 'pointer';
            alert.addEventListener('mouseenter', () => {
                alert.style.transform = 'translateX(5px)';
                alert.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            });
            
            alert.addEventListener('mouseleave', () => {
                alert.style.transform = 'translateX(0)';
                alert.style.boxShadow = 'none';
            });
        });
    }

    handleAlertClick(alertElement) {
        const anomalyId = alertElement.dataset.anomalyId;
        const taxType = alertElement.dataset.taxType;
        const date = alertElement.dataset.date;
        const severity = alertElement.dataset.severity;
        
        // Store the selected anomaly details for the anomaly page
        sessionStorage.setItem('selectedAnomaly', JSON.stringify({
            id: anomalyId,
            taxType: taxType,
            date: date,
            severity: severity
        }));
        
        // Navigate to anomaly detection page
        this.switchPage('anomaly-detection');
        
        // Optional: Highlight the specific anomaly on the anomaly page
        setTimeout(() => {
            this.highlightAnomalyOnPage(anomalyId);
        }, 500);
    }

    highlightAnomalyOnPage(anomalyId) {
        const anomalyRows = document.querySelectorAll('#anomalies-table-body tr');
        anomalyRows.forEach(row => {
            if (row.dataset.anomalyId === anomalyId) {
                // Add highlight class
                row.classList.add('highlighted');
                
                // Scroll to the row
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Remove highlight after 5 seconds
                setTimeout(() => {
                    row.classList.remove('highlighted');
                }, 5000);
            }
        });
    }

    async loadPageSpecificData() {
        switch (this.currentPage) {
            case 'revenue-forecasting':
                await this.loadRevenueForecasting();
                break;
            case 'anomaly-detection':
                await this.loadAnomalyDetection();
                break;
            case 'scenario-planning':
                await this.loadScenarioPlanning();
                break;
        }
    }

    async loadRevenueForecasting() {
        // Initialize forecasting page - no data loaded until user generates forecast
        console.log('Revenue Forecasting page loaded - ready to generate forecasts');
    }

    async generateForecast() {
        const runBtn = document.getElementById('run-forecast');
        const originalText = runBtn.innerHTML;
        
        try {
            // Show loading state
            runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Forecast...';
            runBtn.disabled = true;

            const response = await fetch('/api/forecast/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
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
            
            this.showSuccess('Revenue forecast generated successfully!');

        } catch (error) {
            console.error('Error generating forecast:', error);
            this.showError('Failed to generate forecast: ' + error.message);
        } finally {
            runBtn.innerHTML = '<i class="fas fa-chart-line"></i> Generate Forecast';
            runBtn.disabled = false;
        }
    }

    createForecastChart(forecasts) {
        const dates = forecasts.Total_Revenue.dates;
        
        // Convert dates to proper JavaScript Date objects
        const jsDates = dates.map(date => new Date(date));
        
        const traces = Object.keys(forecasts).map(taxType => {
            return {
                x: jsDates,  // Use JavaScript Date objects
                y: forecasts[taxType].values,
                name: taxType.replace('_', ' '),
                type: 'line',
                mode: 'lines+markers',
                hovertemplate: `${taxType.replace('_', ' ')}: K%{y:,.0f}<extra></extra>`
            };
        });

        const layout = {
            title: {
                text: '12-Month Revenue Forecast by Tax Type',
                font: { size: 18, color: '#2C3E50' }
            },
            xaxis: {
                title: {
                    text: 'Month',
                    font: { size: 12, color: '#7F8C8D' }
                },
                type: 'date',
                tickformat: '%b %Y',
                tickangle: -45,
                gridcolor: '#ECF0F1',
                tickmode: 'auto',
                nticks: 12  // Force 12 ticks for 12 months
            },
            yaxis: {
                title: {
                    text: 'Revenue (ZMW)',
                    font: { size: 12, color: '#7F8C8D' }
                },
                tickformat: ',.0f',
                gridcolor: '#ECF0F1',
                tickprefix: 'K'
            },
            hovermode: 'closest',
            showlegend: true,
            legend: {
                orientation: 'h',
                y: -0.3,
                x: 0.1,
                bgcolor: 'rgba(255,255,255,0.8)',
                bordercolor: '#BDC3C7',
                borderwidth: 1
            },
            margin: { t: 60, r: 40, b: 100, l: 80 },  // Increased bottom margin for dates
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { family: 'Segoe UI, sans-serif' }
        };

        const config = {
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            toImageButtonOptions: {
                format: 'png',
                filename: 'zra_revenue_forecast',
                height: 500,
                width: 800,
                scale: 2
            }
        };

        // Clear any existing plot first
        const chartElement = document.getElementById('revenue-forecast-chart');
        if (chartElement) {
            chartElement.innerHTML = '';
            Plotly.newPlot('revenue-forecast-chart', traces, layout, config);
        }
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
                `${taxType.replace('_', ' ')}<br>${months[i]}<br>K${value.toLocaleString()}`
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
            },
            showscale: true
        };

        const layout = {
            title: {
                text: 'Monthly Revenue Distribution Forecast',
                font: { size: 16, color: '#2C3E50' }
            },
            xaxis: { 
                title: { text: 'Month', font: { size: 12 } },
                tickangle: 0
            },
            yaxis: { 
                title: { text: 'Tax Type', font: { size: 12 } }
            },
            margin: { t: 60, r: 50, b: 80, l: 120 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
        };

        // Clear any existing plot first
        const heatmapElement = document.getElementById('revenue-heatmap');
        if (heatmapElement) {
            heatmapElement.innerHTML = '';
            Plotly.newPlot('revenue-heatmap', [trace], layout, {
                responsive: true,
                displayModeBar: true
            });
        }
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
                <td><strong>${item.tax_type}</strong></td>
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
            this.showError('No forecast data to export. Please generate a forecast first.');
            return;
        }

        try {
            const response = await fetch('/api/forecast/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
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
            
            this.showSuccess('Forecast exported successfully!');
            
        } catch (error) {
            console.error('Error exporting forecast:', error);
            this.showError(error.message || 'Failed to export forecast data');
        }
    }

    async loadAnomalyDetection() {
        try {
            const response = await fetch('/api/anomalies/detections');
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            // Update severity counts
            if (data.severity_counts) {
                document.getElementById('high-severity-count').textContent = data.severity_counts.high;
                document.getElementById('medium-severity-count').textContent = data.severity_counts.medium;
                document.getElementById('low-severity-count').textContent = data.severity_counts.low;
            }

            // Update anomalies table
            const tableBody = document.getElementById('anomalies-table-body');
            if (data.anomalies && data.anomalies.length > 0) {
                tableBody.innerHTML = data.anomalies.map(anomaly => {
                    const anomalyId = anomaly.id || `${anomaly.date}-${anomaly.tax_type}-${anomaly.region}`;
                    return `
                        <tr class="anomaly-row severity-${anomaly.severity}" 
                            data-anomaly-id="${anomalyId}">
                            <td>${anomaly.date}</td>
                            <td>${anomaly.region}</td>
                            <td>${anomaly.tax_type}</td>
                            <td>
                                <span class="severity-badge ${anomaly.severity}">
                                    <i class="fas fa-${this.getSeverityIcon(anomaly.severity)}"></i>
                                    ${anomaly.severity.charAt(0).toUpperCase() + anomaly.severity.slice(1)}
                                </span>
                            </td>
                            <td>${anomaly.amount}</td>
                            <td>${anomaly.deviation}</td>
                            <td>
                                <div class="action-buttons">
                                    <button class="btn-sm btn-info" onclick="dashboard.viewAnomalyDetails(${JSON.stringify(anomaly).replace(/"/g, '&quot;')})">
                                        <i class="fas fa-search"></i> Investigate
                                    </button>
                                    <button class="btn-sm btn-warning" onclick="dashboard.flagAnomaly('${anomaly.date}', '${anomaly.tax_type}')">
                                        <i class="fas fa-flag"></i> Flag
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
                
                // Check if we need to highlight a specific anomaly
                this.checkForAnomalyHighlight();
            } else {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="no-data">
                            <i class="fas fa-check-circle"></i> No anomalies detected in current data
                        </td>
                    </tr>
                `;
            }

            // Load anomaly trends chart
            await this.loadAnomalyTrends(data.anomalies);

        } catch (error) {
            console.error('Error loading anomaly data:', error);
            this.showError('Failed to load anomaly detection data');
        }
    }

    checkForAnomalyHighlight() {
        const selectedAnomaly = sessionStorage.getItem('selectedAnomaly');
        if (selectedAnomaly) {
            const anomaly = JSON.parse(selectedAnomaly);
            this.highlightAnomalyOnPage(anomaly.id);
            
            // Clear the stored selection
            sessionStorage.removeItem('selectedAnomaly');
        }
    }

    async loadAnomalyTrends(anomalies) {
        if (!anomalies || anomalies.length === 0) return;

        // Group anomalies by month and severity for trend analysis
        const monthlyTrends = {};
        
        anomalies.forEach(anomaly => {
            const monthKey = anomaly.date.substring(0, 7); // YYYY-MM
            if (!monthlyTrends[monthKey]) {
                monthlyTrends[monthKey] = { high: 0, medium: 0, low: 0, total: 0 };
            }
            monthlyTrends[monthKey][anomaly.severity]++;
            monthlyTrends[monthKey].total++;
        });

        const months = Object.keys(monthlyTrends).sort();
        const highCounts = months.map(month => monthlyTrends[month].high);
        const mediumCounts = months.map(month => monthlyTrends[month].medium);
        const lowCounts = months.map(month => monthlyTrends[month].low);
        const totalCounts = months.map(month => monthlyTrends[month].total);

        const traces = [
            {
                x: months,
                y: totalCounts,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Total Anomalies',
                line: { color: '#2C3E50', width: 3 }
            },
            {
                x: months,
                y: highCounts,
                type: 'bar',
                name: 'High Severity',
                marker: { color: '#C73E1D' }
            },
            {
                x: months,
                y: mediumCounts,
                type: 'bar',
                name: 'Medium Severity',
                marker: { color: '#F18F01' }
            },
            {
                x: months,
                y: lowCounts,
                type: 'bar',
                name: 'Low Severity',
                marker: { color: '#2E86AB' }
            }
        ];

        const layout = {
            title: {
                text: 'Anomaly Detection Trends Over Time',
                font: { size: 16, color: '#2C3E50' }
            },
            xaxis: {
                title: { text: 'Month', font: { size: 12 } },
                tickangle: -45
            },
            yaxis: {
                title: { text: 'Number of Anomalies', font: { size: 12 } }
            },
            barmode: 'stack',
            hovermode: 'closest',
            showlegend: true,
            legend: { orientation: 'h', y: -0.3 },
            margin: { t: 60, r: 50, b: 80, l: 80 }
        };

        // Create chart if element exists
        const chartContainer = document.getElementById('anomaly-trends-chart');
        if (chartContainer) {
            Plotly.newPlot('anomaly-trends-chart', traces, layout, {
                responsive: true,
                displayModeBar: true
            });
        }
    }

    async loadScenarioPlanning() {
        // Initialize scenario controls with current values
        this.updateScenarioImpactPreview();
    }

    updateScenarioImpactPreview() {
        // Simple client-side calculation for immediate feedback
        const vatRate = parseFloat(document.getElementById('vat-slider').value);
        const baseVatRate = 16; // Current VAT rate
        
        const vatImpact = ((vatRate - baseVatRate) / baseVatRate) * 100;
        
        const impactElement = document.getElementById('revenue-change-value');
        if (impactElement) {
            impactElement.textContent = `${vatImpact >= 0 ? '+' : ''}${vatImpact.toFixed(1)}%`;
            impactElement.className = `result-value ${vatImpact >= 0 ? 'positive' : 'negative'}`;
        }
    }

    async runScenarioSimulation() {
        const runBtn = document.getElementById('run-simulation');
        const originalText = runBtn.innerHTML;
        
        try {
            // Show loading state
            runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running Simulation...';
            runBtn.disabled = true;

            const vatRate = parseFloat(document.getElementById('vat-slider').value);
            const corpTaxRate = parseFloat(document.getElementById('corp-tax-slider').value);
            const incomeTaxRate = parseFloat(document.getElementById('income-tax-slider').value);
            
            const response = await fetch('/api/scenario/run-simulation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    vat_rate: vatRate,
                    corporate_tax_rate: corpTaxRate,
                    income_tax_rate: incomeTaxRate
                })
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            this.displayScenarioResults(data);

        } catch (error) {
            console.error('Error running scenario:', error);
            this.showError('Failed to run scenario simulation: ' + error.message);
        } finally {
            runBtn.innerHTML = '<i class="fas fa-play"></i> Run Simulation';
            runBtn.disabled = false;
        }
    }

    displayScenarioResults(results) {
        // Update revenue change value
        const revenueChangeElement = document.getElementById('revenue-change-value');
        if (revenueChangeElement) {
            revenueChangeElement.textContent = results.revenue_change.formatted_absolute;
            revenueChangeElement.className = `result-value ${
                results.revenue_change.absolute >= 0 ? 'positive' : 'negative'
            }`;
        }

        // Display scenario comparison chart
        this.createScenarioChart(results.chart_data);
    }

    createScenarioChart(chartData) {
        const baselineTrace = {
            x: chartData.dates,
            y: chartData.baseline,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Baseline Forecast',
            line: { 
                color: '#2E86AB', 
                width: 3 
            },
            marker: { size: 6 }
        };

        const scenarioTrace = {
            x: chartData.dates,
            y: chartData.scenario,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Policy Scenario',
            line: { 
                color: '#A23B72', 
                width: 3,
                dash: 'dash'
            },
            marker: { size: 6 }
        };

        const differenceTrace = {
            x: chartData.dates,
            y: chartData.differences,
            type: 'bar',
            name: 'Revenue Impact',
            marker: { 
                color: chartData.differences.map(diff => diff >= 0 ? '#28a745' : '#dc3545'),
                opacity: 0.6
            },
            yaxis: 'y2'
        };

        const layout = {
            title: {
                text: 'Tax Policy Scenario Analysis: Revenue Impact Forecast',
                font: { size: 16, color: '#2C3E50' }
            },
            xaxis: {
                title: { text: 'Forecast Period', font: { size: 12 } },
                type: 'date',
                tickformat: '%b %Y',
                tickangle: -45
            },
            yaxis: {
                title: { text: 'Total Revenue (ZMW)', font: { size: 12 } },
                tickformat: ',.0f',
                gridcolor: '#ECF0F1'
            },
            yaxis2: {
                title: { text: 'Revenue Impact (ZMW)', font: { size: 12 } },
                overlaying: 'y',
                side: 'right',
                tickformat: ',.0f',
                gridcolor: 'rgba(0,0,0,0)'
            },
            hovermode: 'closest',
            showlegend: true,
            legend: {
                orientation: 'h',
                y: -0.3,
                x: 0.1
            },
            margin: { t: 60, r: 80, b: 80, l: 80 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
        };

        const chartElement = document.getElementById('scenario-chart');
        if (chartElement) {
            Plotly.newPlot('scenario-chart', 
                [baselineTrace, scenarioTrace, differenceTrace], 
                layout, {
                    responsive: true,
                    displayModeBar: true
                }
            );
        }
    }

    viewAnomalyDetails(anomaly) {
        // Create a detailed modal view for the anomaly
        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Anomaly Investigation</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="anomaly-details">
                            <div class="detail-row">
                                <label>Tax Type:</label>
                                <span>${anomaly.tax_type}</span>
                            </div>
                            <div class="detail-row">
                                <label>Date:</label>
                                <span>${anomaly.date}</span>
                            </div>
                            <div class="detail-row">
                                <label>Severity:</label>
                                <span class="severity-badge ${anomaly.severity}">${anomaly.severity}</span>
                            </div>
                            <div class="detail-row">
                                <label>Actual Revenue:</label>
                                <span>${anomaly.amount}</span>
                            </div>
                            <div class="detail-row">
                                <label>Predicted Revenue:</label>
                                <span>K${Math.round(anomaly.predicted_value).toLocaleString()}</span>
                            </div>
                            <div class="detail-row">
                                <label>Deviation:</label>
                                <span>${anomaly.deviation}</span>
                            </div>
                            <div class="detail-row">
                                <label>Potential Causes:</label>
                                <ul>
                                    <li>Data reporting error</li>
                                    <li>Seasonal fluctuation</li>
                                    <li>Policy change impact</li>
                                    <li>Economic event</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-primary" onclick="dashboard.flagAnomaly('${anomaly.date}', '${anomaly.tax_type}')">
                            <i class="fas fa-flag"></i> Flag for Review
                        </button>
                        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    flagAnomaly(date, taxType) {
        // Send flag to backend for review
        fetch('/api/anomalies/flag', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                date: date,
                tax_type: taxType,
                action: 'flagged'
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.showSuccess(`Anomaly flagged for review: ${taxType} on ${date}`);
            } else {
                this.showError('Failed to flag anomaly');
            }
        })
        .catch(error => {
            console.error('Error flagging anomaly:', error);
            this.showError('Failed to flag anomaly');
        });
    }

    getSeverityIcon(severity) {
        switch (severity) {
            case 'high': return 'exclamation-triangle';
            case 'medium': return 'exclamation-circle';
            case 'low': return 'info-circle';
            default: return 'question-circle';
        }
    }

    showError(message, elementId = null) {
        if (elementId) {
            const element = document.getElementById(elementId);
            if (element) {
                element.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i> ${message}</div>`;
            }
        } else {
            // Create a temporary error notification
            const errorDiv = document.createElement('div');
            errorDiv.className = 'global-error';
            errorDiv.innerHTML = `
                <div class="error-content">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>${message}</span>
                    <button onclick="this.parentElement.parentElement.remove()">&times;</button>
                </div>
            `;
            document.body.appendChild(errorDiv);
            
            setTimeout(() => {
                if (errorDiv.parentElement) {
                    errorDiv.remove();
                }
            }, 5000);
        }
    }

    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'global-success';
        successDiv.innerHTML = `
            <div class="success-content">
                <i class="fas fa-check-circle"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()">&times;</button>
            </div>
        `;
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            if (successDiv.parentElement) {
                successDiv.remove();
            }
        }, 3000);
    }

    // Utility method to format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-ZM', {
            style: 'currency',
            currency: 'ZMW',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.dashboard = new RevenueDashboard();
});
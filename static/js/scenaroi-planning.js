class ScenarioPlanning {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.currentScenario = null;
        this.isLoading = false;
    }

    initializeSliders() {
        const sliders = [
            { id: 'vat-slider', valueId: 'vat-value', suffix: '%', min: 5, max: 25, step: 0.5, defaultValue: 16 },
            { id: 'corp-tax-slider', valueId: 'corp-tax-value', suffix: '%', min: 15, max: 45, step: 0.5, defaultValue: 35 },
            { id: 'income-tax-slider', valueId: 'income-tax-value', suffix: '%', min: 20, max: 50, step: 0.5, defaultValue: 37.5 }
        ];

        sliders.forEach(sliderConfig => {
            const slider = document.getElementById(sliderConfig.id);
            const valueDisplay = document.getElementById(sliderConfig.valueId);

            if (slider && valueDisplay) {
                // Set slider attributes
                slider.min = sliderConfig.min;
                slider.max = sliderConfig.max;
                slider.step = sliderConfig.step;
                slider.value = sliderConfig.defaultValue;
                valueDisplay.textContent = sliderConfig.defaultValue + sliderConfig.suffix;

                // Add event listener
                slider.addEventListener('input', (e) => {
                    valueDisplay.textContent = e.target.value + sliderConfig.suffix;
                    this.debouncedCalculateImpact();
                });
            }
        });

        // Initialize calculation
        this.calculateRevenueImpact();
    }

    debouncedCalculateImpact = this.debounce(() => {
        this.calculateRevenueImpact();
    }, 500);

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    async calculateRevenueImpact() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.showLoadingState();

        try {
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

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const result = await response.json();
            this.displayScenarioResults(result);

        } catch (error) {
            console.error('Error calculating revenue impact:', error);
            this.displayError('Failed to calculate scenario impact. Please try again.');
        } finally {
            this.isLoading = false;
            this.hideLoadingState();
        }
    }

    displayScenarioResults(result) {
        console.log('Scenario Results:', result);
        
        // Update impact display with proper formatting
        const impactElement = document.getElementById('revenue-change-value');
        if (impactElement) {
            const changePct = result.impact_percentage || 0;
            impactElement.textContent = `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%`;
            impactElement.className = `result-value ${changePct >= 0 ? 'positive' : 'negative'}`;
        }

        // Update absolute change
        const absoluteElement = document.getElementById('revenue-change-absolute');
        if (absoluteElement) {
            const changeAmount = result.revenue_change || 0;
            const formattedAmount = `K${(changeAmount / 1e6).toFixed(1)}M`;
            absoluteElement.textContent = changeAmount >= 0 ? `+${formattedAmount}` : formattedAmount;
            absoluteElement.className = `result-absolute ${changeAmount >= 0 ? 'positive' : 'negative'}`;
        }

        // Update current revenue
        const currentElement = document.getElementById('current-revenue-value');
        if (currentElement && result.current_revenue) {
            currentElement.textContent = `K${(result.current_revenue / 1e6).toFixed(1)}M`;
        }

        // Update projected revenue
        const projectedElement = document.getElementById('projected-revenue-value');
        if (projectedElement && result.projected_revenue) {
            projectedElement.textContent = `K${(result.projected_revenue / 1e6).toFixed(1)}M`;
        }

        // Update methodology info
        const methodologyElement = document.getElementById('methodology-info');
        if (methodologyElement) {
            methodologyElement.textContent = `Method: ${result.methodology || 'Intelligent Forecasting'}`;
        }

        // Update tax breakdown
        this.updateTaxBreakdown(result.tax_breakdown);

        // Update charts
        this.updateScenarioCharts(result);

        // Store current scenario
        this.currentScenario = result;
    }

    updateTaxBreakdown(taxBreakdown) {
        if (!taxBreakdown) return;

        const breakdownContainer = document.getElementById('tax-breakdown-container');
        if (!breakdownContainer) return;

        // Clear existing breakdown
        breakdownContainer.innerHTML = '';

        const taxes = [
            { key: 'vat', label: 'VAT', color: '#36a2eb' },
            { key: 'income_tax', label: 'Income Tax', color: '#4bc0c0' },
            { key: 'customs', label: 'Customs', color: '#ffcd56' },
            { key: 'excise', label: 'Excise', color: '#ff6384' }
        ];

        taxes.forEach(tax => {
            if (taxBreakdown[tax.key]) {
                const taxElement = document.createElement('div');
                taxElement.className = 'tax-breakdown-item';
                taxElement.innerHTML = `
                    <div class="tax-color" style="background-color: ${tax.color}"></div>
                    <div class="tax-label">${tax.label}</div>
                    <div class="tax-value">K${(taxBreakdown[tax.key] / 1e6).toFixed(1)}M</div>
                `;
                breakdownContainer.appendChild(taxElement);
            }
        });
    }

    updateScenarioCharts(result) {
        // Update main revenue comparison chart
        this.updateRevenueComparisonChart(result);
        
        // Update tax breakdown chart
        this.updateTaxBreakdownChart(result);
    }

    updateRevenueComparisonChart(result) {
        const ctx = document.getElementById('scenario-chart');
        if (!ctx) return;

        const currentRevenue = result.current_revenue / 1e6;
        const projectedRevenue = result.projected_revenue / 1e6;

        // Destroy existing chart if it exists
        if (window.scenarioChart) {
            window.scenarioChart.destroy();
        }

        window.scenarioChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Current Revenue', 'Projected Revenue'],
                datasets: [{
                    label: 'Revenue (K Millions)',
                    data: [currentRevenue, projectedRevenue],
                    backgroundColor: [
                        currentRevenue >= projectedRevenue ? '#ff6384' : '#36a2eb',
                        projectedRevenue >= currentRevenue ? '#4bc0c0' : '#ff6384'
                    ],
                    borderColor: [
                        currentRevenue >= projectedRevenue ? '#ff6384' : '#36a2eb',
                        projectedRevenue >= currentRevenue ? '#4bc0c0' : '#ff6384'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Revenue Impact Analysis',
                        font: {
                            size: 16
                        }
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Revenue (K Millions)'
                        }
                    }
                }
            }
        });
    }

    updateTaxBreakdownChart(result) {
        const ctx = document.getElementById('tax-breakdown-chart');
        if (!ctx || !result.tax_breakdown) return;

        const taxBreakdown = result.tax_breakdown;

        // Destroy existing chart if it exists
        if (window.taxBreakdownChart) {
            window.taxBreakdownChart.destroy();
        }

        window.taxBreakdownChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['VAT', 'Income Tax', 'Customs', 'Excise'],
                datasets: [{
                    data: [
                        taxBreakdown.vat / 1e6,
                        taxBreakdown.income_tax / 1e6,
                        taxBreakdown.customs / 1e6,
                        taxBreakdown.excise / 1e6
                    ],
                    backgroundColor: [
                        '#36a2eb',
                        '#4bc0c0', 
                        '#ffcd56',
                        '#ff6384'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Projected Tax Revenue Breakdown',
                        font: {
                            size: 14
                        }
                    },
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: K${context.raw.toFixed(1)}M`;
                            }
                        }
                    }
                }
            }
        });
    }

    showLoadingState() {
        const calculateBtn = document.getElementById('calculate-scenario-btn');
        const impactElement = document.getElementById('revenue-change-value');
        
        if (calculateBtn) calculateBtn.disabled = true;
        if (impactElement) {
            impactElement.textContent = 'Calculating...';
            impactElement.className = 'result-value loading';
        }

        // Show loading spinner if exists
        const loadingSpinner = document.getElementById('scenario-loading');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'block';
        }
    }

    hideLoadingState() {
        const calculateBtn = document.getElementById('calculate-scenario-btn');
        if (calculateBtn) calculateBtn.disabled = false;

        // Hide loading spinner
        const loadingSpinner = document.getElementById('scenario-loading');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }
    }

    displayError(message) {
        const impactElement = document.getElementById('revenue-change-value');
        if (impactElement) {
            impactElement.textContent = 'Error';
            impactElement.className = 'result-value error';
        }
        
        // Show error message
        const errorElement = document.getElementById('scenario-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            
            // Hide error after 5 seconds
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }
        
        console.error('Scenario Error:', message);
    }

    // Method to export scenario results
    exportScenario() {
        if (!this.currentScenario) {
            alert('No scenario results to export');
            return;
        }

        const dataStr = JSON.stringify(this.currentScenario, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `scenario-analysis-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // Method to reset sliders to default values
    resetSliders() {
        const sliders = [
            { id: 'vat-slider', valueId: 'vat-value', defaultValue: 16 },
            { id: 'corp-tax-slider', valueId: 'corp-tax-value', defaultValue: 35 },
            { id: 'income-tax-slider', valueId: 'income-tax-value', defaultValue: 37.5 }
        ];

        sliders.forEach(sliderConfig => {
            const slider = document.getElementById(sliderConfig.id);
            const valueDisplay = document.getElementById(sliderConfig.valueId);

            if (slider && valueDisplay) {
                slider.value = sliderConfig.defaultValue;
                valueDisplay.textContent = sliderConfig.defaultValue + '%';
            }
        });

        // Recalculate with default values
        this.calculateRevenueImpact();
    }
}

// Initialize scenario planning when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (typeof window.dashboard !== 'undefined') {
        window.scenarioPlanning = new ScenarioPlanning(window.dashboard);
        window.scenarioPlanning.initializeSliders();
    }
});
from flask import Blueprint, jsonify
import pandas as pd
import os
from datetime import datetime, timedelta

dashboard_bp = Blueprint('dashboard', __name__)

def load_data_files():
    """Load data files with error handling"""
    data_files = {}
    base_path = os.path.join(os.path.dirname(__file__), '..', 'data')
    
    try:
        # Load baseline forecast data
        baseline_path = os.path.join(base_path, 'revpredict_baseline_forecast.csv')
        data_files['baseline_forecast'] = pd.read_csv(baseline_path)
        data_files['baseline_forecast']['date'] = pd.to_datetime(data_files['baseline_forecast']['date'])
        
        # Load test results data
        test_path = os.path.join(base_path, 'revpredict_test_results.csv')
        data_files['test_results'] = pd.read_csv(test_path)
        data_files['test_results']['date'] = pd.to_datetime(data_files['test_results']['date'])
        
        # Load model performance data
        performance_path = os.path.join(base_path, 'revpredict_model_performance.csv')
        data_files['model_performance'] = pd.read_csv(performance_path)
        
        # Load scenario data
        scenario_path = os.path.join(base_path, 'revpredict_vat_scenario.csv')
        data_files['scenario_data'] = pd.read_csv(scenario_path)
        data_files['scenario_data']['date'] = pd.to_datetime(data_files['scenario_data']['date'])
        
    except Exception as e:
        print(f"Error loading data files: {str(e)}")
        # Create empty DataFrames if files can't be loaded
        for key in ['baseline_forecast', 'test_results', 'model_performance', 'scenario_data']:
            if key not in data_files:
                data_files[key] = pd.DataFrame()
    
    return data_files

# Load data once when the module is imported
data_files = load_data_files()

@dashboard_bp.route('/api/dashboard/kpis')
def get_dashboard_kpis():
    """Get KPI data for dashboard overview"""
    try:
        baseline_data = data_files['baseline_forecast']
        test_data = data_files['test_results']
        
        if baseline_data.empty:
            return jsonify({'error': 'No data available'}), 500
        
        # Calculate total revenue for latest month
        latest_month = baseline_data.iloc[-1]
        total_revenue = latest_month['Total_Revenue']
        
        # Calculate growth rate (comparing last two months)
        if len(baseline_data) >= 2:
            prev_month = baseline_data.iloc[-2]
            current_month = baseline_data.iloc[-1]
            growth_rate = ((current_month['Total_Revenue'] - prev_month['Total_Revenue']) / 
                          prev_month['Total_Revenue']) * 100
        else:
            growth_rate = 0
        
        # Calculate anomalies count from test results
        anomalies_count = 0
        if not test_data.empty:
            # Count instances where actual differs significantly from predicted (>15% deviation)
            for tax_type in test_data['stream'].unique():
                tax_data = test_data[test_data['stream'] == tax_type]
                if len(tax_data) > 0:
                    deviation = abs(tax_data['actual'] - tax_data['predicted']) / tax_data['actual']
                    anomalies_count += len(deviation[deviation > 0.15])
        
        return jsonify({
            'total_revenue': {
                'value': f"K{total_revenue:,.0f}",
                'trend': 'positive' if growth_rate >= 0 else 'negative',
                'trend_value': f"{abs(growth_rate):.1f}%"
            },
            'growth_rate': {
                'value': f"{growth_rate:.1f}%",
                'trend': 'positive' if growth_rate >= 0 else 'negative',
                'trend_value': f"{abs(growth_rate):.1f}%"
            },
            'anomalies': {
                'value': f"{anomalies_count}",
                'trend': 'negative' if anomalies_count > 5 else 'positive',
                'trend_value': f"{anomalies_count} detected"
            }
        })
        
    except Exception as e:
        print(f"Error calculating KPIs: {str(e)}")
        return jsonify({'error': 'Failed to calculate KPIs'}), 500

@dashboard_bp.route('/api/dashboard/revenue-forecast')
def get_revenue_forecast():
    """Get revenue forecast data for charts"""
    try:
        baseline_data = data_files['baseline_forecast']
        
        if baseline_data.empty:
            return jsonify({'error': 'No forecast data available'}), 500
        
        # Prepare data for chart
        chart_data = {
            'dates': baseline_data['date'].dt.strftime('%Y-%m-%d').tolist(),
            'VAT': baseline_data['VAT'].tolist(),
            'Income_Tax': baseline_data['Income_Tax'].tolist(),
            'Customs_Duties': baseline_data['Customs_Duties'].tolist(),
            'Excise_Tax': baseline_data['Excise_Tax'].tolist(),
            'Total_Revenue': baseline_data['Total_Revenue'].tolist()
        }
        
        return jsonify(chart_data)
        
    except Exception as e:
        print(f"Error getting revenue forecast: {str(e)}")
        return jsonify({'error': 'Failed to load forecast data'}), 500
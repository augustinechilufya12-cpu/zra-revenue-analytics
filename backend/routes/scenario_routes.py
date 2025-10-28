from flask import Blueprint, request, jsonify
import pandas as pd
import os
import numpy as np

scenario_bp = Blueprint('scenario', __name__)

def load_data_files():
    """Load data files with error handling"""
    data_files = {}
    base_path = os.path.join(os.path.dirname(__file__), '..', 'data')
    
    try:
        # Load baseline forecast data
        baseline_path = os.path.join(base_path, 'revpredict_baseline_forecast.csv')
        data_files['baseline_forecast'] = pd.read_csv(baseline_path)
        data_files['baseline_forecast']['date'] = pd.to_datetime(data_files['baseline_forecast']['date'])
        
        # Load scenario data
        scenario_path = os.path.join(base_path, 'revpredict_vat_scenario.csv')
        data_files['scenario_data'] = pd.read_csv(scenario_path)
        data_files['scenario_data']['date'] = pd.to_datetime(data_files['scenario_data']['date'])
        
    except Exception as e:
        print(f"Error loading data files: {str(e)}")
        # Create empty DataFrames if files can't be loaded
        for key in ['baseline_forecast', 'scenario_data']:
            if key not in data_files:
                data_files[key] = pd.DataFrame()
    
    return data_files

# Load data once when the module is imported
data_files = load_data_files()

@scenario_bp.route('/api/scenario/run-simulation', methods=['POST'])
def run_scenario_simulation():
    """Run scenario simulation based on tax rate changes"""
    try:
        data = request.get_json()
        vat_rate = data.get('vat_rate', 16)
        
        baseline_data = data_files['baseline_forecast']
        scenario_data = data_files['scenario_data']
        
        if baseline_data.empty or scenario_data.empty:
            return jsonify({'error': 'No scenario data available'}), 500
        
        # Calculate impact based on VAT rate change
        original_vat_total = baseline_data['VAT'].sum()
        scenario_vat_total = scenario_data['VAT'].sum()
        
        revenue_change = scenario_vat_total - original_vat_total
        change_percentage = (revenue_change / original_vat_total) * 100
        
        # Calculate differences for each month
        differences = []
        for i in range(len(baseline_data)):
            diff = scenario_data.iloc[i]['Total_Revenue'] - baseline_data.iloc[i]['Total_Revenue']
            differences.append(diff)
        
        # Prepare scenario results
        scenario_results = {
            'revenue_change': {
                'absolute': revenue_change,
                'percentage': change_percentage,
                'formatted_absolute': f"K{revenue_change:+,.0f}",
                'formatted_percentage': f"{change_percentage:+.1f}%"
            },
            'chart_data': {
                'dates': baseline_data['date'].dt.strftime('%Y-%m-%d').tolist(),
                'baseline': baseline_data['Total_Revenue'].tolist(),
                'scenario': scenario_data['Total_Revenue'].tolist(),
                'differences': differences
            }
        }
        
        return jsonify(scenario_results)
        
    except Exception as e:
        print(f"Error running scenario: {str(e)}")
        return jsonify({'error': 'Failed to run scenario simulation'}), 500
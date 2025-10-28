from flask import Blueprint, jsonify
import pandas as pd
import os

analytics_bp = Blueprint('analytics', __name__)

def load_data_files():
    """Load data files with error handling"""
    data_files = {}
    base_path = os.path.join(os.path.dirname(__file__), '..', 'data')
    
    try:
        # Load baseline forecast data
        baseline_path = os.path.join(base_path, 'revpredict_baseline_forecast.csv')
        data_files['baseline_forecast'] = pd.read_csv(baseline_path)
        data_files['baseline_forecast']['date'] = pd.to_datetime(data_files['baseline_forecast']['date'])
        
        # Load model performance data
        performance_path = os.path.join(base_path, 'revpredict_model_performance.csv')
        data_files['model_performance'] = pd.read_csv(performance_path)
        
    except Exception as e:
        print(f"Error loading data files: {str(e)}")
        # Create empty DataFrames if files can't be loaded
        for key in ['baseline_forecast', 'model_performance']:
            if key not in data_files:
                data_files[key] = pd.DataFrame()
    
    return data_files

# Load data once when the module is imported
data_files = load_data_files()

@analytics_bp.route('/api/analytics/revenue-data')
def get_revenue_analytics():
    """Get comprehensive revenue analytics data"""
    try:
        baseline_data = data_files['baseline_forecast']
        
        if baseline_data.empty:
            return jsonify({'error': 'No analytics data available'}), 500
        
        # Prepare data for analytics charts
        analytics_data = {
            'forecast_chart': {
                'dates': baseline_data['date'].dt.strftime('%Y-%m-%d').tolist(),
                'total_revenue': baseline_data['Total_Revenue'].tolist(),
                'tax_breakdown': {
                    'VAT': baseline_data['VAT'].tolist(),
                    'Income_Tax': baseline_data['Income_Tax'].tolist(),
                    'Customs_Duties': baseline_data['Customs_Duties'].tolist(),
                    'Excise_Tax': baseline_data['Excise_Tax'].tolist()
                }
            },
            'performance_metrics': data_files['model_performance'].to_dict('records')
        }
        
        return jsonify(analytics_data)
        
    except Exception as e:
        print(f"Error getting revenue analytics: {str(e)}")
        return jsonify({'error': 'Failed to load analytics data'}), 500

@analytics_bp.route('/api/analytics/heatmap-data')
def get_heatmap_data():
    """Get data for revenue heatmap"""
    try:
        baseline_data = data_files['baseline_forecast']
        
        if baseline_data.empty:
            return jsonify({'error': 'No heatmap data available'}), 500
        
        # Create monthly heatmap data
        baseline_data['month'] = baseline_data['date'].dt.month
        baseline_data['year'] = baseline_data['date'].dt.year
        
        heatmap_data = []
        tax_types = ['VAT', 'Income_Tax', 'Customs_Duties', 'Excise_Tax']
        
        for tax_type in tax_types:
            monthly_avg = baseline_data.groupby('month')[tax_type].mean()
            for month, value in monthly_avg.items():
                heatmap_data.append({
                    'tax_type': tax_type,
                    'month': month,
                    'revenue': value,
                    'month_name': pd.Timestamp(year=2020, month=month, day=1).strftime('%B')
                })
        
        return jsonify(heatmap_data)
        
    except Exception as e:
        print(f"Error getting heatmap data: {str(e)}")
        return jsonify({'error': 'Failed to load heatmap data'}), 500

@analytics_bp.route('/api/analytics/model-performance')
def get_model_performance():
    """Get model performance metrics"""
    try:
        performance_data = data_files['model_performance']
        
        if performance_data.empty:
            return jsonify({'error': 'No performance data available'}), 500
        
        return jsonify({
            'performance_metrics': performance_data.to_dict('records')
        })
        
    except Exception as e:
        print(f"Error getting model performance: {str(e)}")
        return jsonify({'error': 'Failed to load model performance data'}), 500
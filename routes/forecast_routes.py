from flask import Blueprint, jsonify, request
import pandas as pd
import os
from models.advanced_forecast_engine import AdvancedForecastEngine
from config import config

forecast_bp = Blueprint('forecast', __name__)

# Initialize forecast engine
forecast_engine = AdvancedForecastEngine(config)

@forecast_bp.route('/api/forecast/generate', methods=['POST'])
def generate_forecast():
    """Generate annual revenue forecast using trained models"""
    try:
        forecasts = forecast_engine.generate_annual_forecast()
        
        if not forecasts:
            return jsonify({'error': 'Failed to generate forecast. Models may not be loaded.'}), 500
        
        # Prepare data for frontend
        forecast_data = {
            'forecasts': forecasts,
            'summary': forecast_engine.get_forecast_summary(forecasts),
            'generated_at': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        return jsonify(forecast_data)
        
    except Exception as e:
        print(f"Error generating forecast: {str(e)}")
        return jsonify({'error': 'Failed to generate forecast'}), 500

@forecast_bp.route('/api/forecast/export', methods=['POST'])
def export_forecast():
    """Export forecast data as CSV"""
    try:
        data = request.get_json()
        forecasts = data.get('forecasts', {})
        
        if not forecasts:
            return jsonify({'error': 'No forecast data to export'}), 400
        
        # Create DataFrame for export
        export_data = []
        
        # Get all dates from first tax type
        first_tax = list(forecasts.keys())[0]
        dates = forecasts[first_tax]['dates']
        
        for i, date in enumerate(dates):
            row = {'Date': date}
            for tax_type, data in forecasts.items():
                row[tax_type.replace('_', ' ')] = data['values'][i]
            export_data.append(row)
        
        df = pd.DataFrame(export_data)
        csv_data = df.to_csv(index=False)
        
        return jsonify({
            'csv_data': csv_data,
            'filename': f'revenue_forecast_{pd.Timestamp.now().strftime("%Y%m%d_%H%M%S")}.csv'
        })
        
    except Exception as e:
        print(f"Error exporting forecast: {str(e)}")
        return jsonify({'error': 'Failed to export forecast data'}), 500
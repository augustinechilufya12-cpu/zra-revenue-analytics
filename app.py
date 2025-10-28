from flask import Flask, render_template, jsonify, request, session
from flask_cors import CORS
import pandas as pd
import numpy as np
import sys
import os
import json
from datetime import datetime, timedelta
import pickle

# Import the ML engines
from models.model_scenario_engine import ModelScenarioEngine
from models.advanced_forecast_engine import AdvancedForecastEngine

import sys
import os

# Check numpy compatibility first
try:
    import numpy as np
    print(f"✅ Numpy version: {np.__version__}")
    # Check if it's a compatible version
    if np.__version__.startswith('2.'):
        print("❌ WARNING: Numpy 2.x may cause compatibility issues")
except ImportError as e:
    print(f"❌ Numpy import error: {e}")
    sys.exit(1)
except ValueError as e:
    if "numpy.dtype size changed" in str(e):
        print("❌ Numpy compatibility error!")
        print("💡 Please run: pip install numpy==1.26.4")
        sys.exit(1)
    raise

# Now import other packages
try:
    import pandas as pd
    from flask import Flask, render_template, jsonify, request, session
    from flask_cors import CORS
    from datetime import datetime, timedelta
    import pickle
    import json
    
    print("✅ All core imports successful")
    
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("💡 Please install required packages:")
    print("   pip install pandas flask flask-cors scikit-learn prophet xgboost")
    sys.exit(1)

# Try to import ML engines with error handling
try:
    from models.model_scenario_engine import ModelScenarioEngine
    ML_ENGINES_AVAILABLE = True
    print("✅ ML engines import successful")
except ImportError as e:
    print(f"⚠️ ML engines import warning: {e}")
    ML_ENGINES_AVAILABLE = False
    ModelScenarioEngine = None

try:
    from models.advanced_forecast_engine import AdvancedForecastEngine
    FORECAST_ENGINE_AVAILABLE = True
    print("✅ Forecast engine import successful")
except ImportError as e:
    print(f"⚠️ Forecast engine import warning: {e}")
    FORECAST_ENGINE_AVAILABLE = False
    AdvancedForecastEngine = None

app = Flask(__name__, 
           template_folder='templates',
           static_folder='static')
app.secret_key = 'zra_revenue_analytics_secret_key_2024'
CORS(app)

# Configuration - FIXED PATHS
app.config['DATA_FOLDER'] = os.path.join(os.path.dirname(__file__), 'data')
app.config['MODELS_FOLDER'] = os.path.join(os.path.dirname(__file__), 'trained_models')

# Initialize ML Engines with robust error handling
scenario_engine = None
forecast_engine = None

if ML_ENGINES_AVAILABLE:
    try:
        scenario_engine = ModelScenarioEngine(app.config)
        print("✅ ML Scenario Engine initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize ML Scenario Engine: {e}")
        scenario_engine = None
else:
    print("⚠️ ML Scenario Engine not available (import failed)")

if FORECAST_ENGINE_AVAILABLE:
    try:
        forecast_engine = AdvancedForecastEngine(app.config)
        if forecast_engine:
            if hasattr(forecast_engine, 'models_loaded') and forecast_engine.models_loaded:
                print("✅ Advanced Forecast Engine initialized successfully")
                print(f"📊 ML Models loaded: {len(forecast_engine.models)}")
            elif hasattr(forecast_engine, 'fallback_models') and forecast_engine.fallback_models:
                print("⚠️ Forecast Engine using fallback models only")
                print(f"🔄 Fallback models: {len(forecast_engine.fallback_models)}")
            else:
                print("❌ Forecast Engine failed to load any models")
        else:
            print("❌ Forecast Engine initialization returned None")
    except Exception as e:
        print(f"❌ Failed to initialize Advanced Forecast Engine: {e}")
        forecast_engine = None
else:
    print("⚠️ Advanced Forecast Engine not available (import failed)")

def load_data_files():
    """Load all CSV data files with robust error handling"""
    data_files = {}
    try:
        print("📁 Loading data files...")
        
        # Load baseline forecast data
        baseline_path = os.path.join(app.config['DATA_FOLDER'], 'revpredict_baseline_forecast.csv')
        if os.path.exists(baseline_path):
            data_files['baseline_forecast'] = pd.read_csv(baseline_path)
            data_files['baseline_forecast']['date'] = pd.to_datetime(data_files['baseline_forecast']['date'])
            print(f"✅ Baseline forecast data loaded: {len(data_files['baseline_forecast'])} records")
        else:
            print(f"❌ Baseline forecast file not found: {baseline_path}")
            data_files['baseline_forecast'] = pd.DataFrame()
        
        # Load test results data
        test_results_path = os.path.join(app.config['DATA_FOLDER'], 'revpredict_test_results.csv')
        if os.path.exists(test_results_path):
            data_files['test_results'] = pd.read_csv(test_results_path)
            data_files['test_results']['date'] = pd.to_datetime(data_files['test_results']['date'])
            print(f"✅ Test results data loaded: {len(data_files['test_results'])} records")
        else:
            print(f"❌ Test results file not found: {test_results_path}")
            data_files['test_results'] = pd.DataFrame()
        
        # Load model performance data
        performance_path = os.path.join(app.config['DATA_FOLDER'], 'revpredict_model_performance.csv')
        if os.path.exists(performance_path):
            data_files['model_performance'] = pd.read_csv(performance_path)
            print(f"✅ Model performance data loaded: {len(data_files['model_performance'])} records")
        else:
            print(f"❌ Model performance file not found: {performance_path}")
            data_files['model_performance'] = pd.DataFrame()
        
        # Load scenario data
        scenario_path = os.path.join(app.config['DATA_FOLDER'], 'revpredict_vat_scenario.csv')
        if os.path.exists(scenario_path):
            data_files['scenario_data'] = pd.read_csv(scenario_path)
            data_files['scenario_data']['date'] = pd.to_datetime(data_files['scenario_data']['date'])
            print(f"✅ Scenario data loaded: {len(data_files['scenario_data'])} records")
        else:
            print(f"❌ Scenario data file not found: {scenario_path}")
            data_files['scenario_data'] = pd.DataFrame()
        
        print("✅ All data files loaded successfully")
        
    except Exception as e:
        print(f"❌ Error loading data files: {str(e)}")
        # Create empty DataFrames if files can't be loaded
        for key in ['baseline_forecast', 'test_results', 'model_performance', 'scenario_data']:
            if key not in data_files:
                data_files[key] = pd.DataFrame()
    
    return data_files

# Global data storage
data_files = load_data_files()

# Authentication routes
@app.route('/api/login', methods=['GET', 'POST'], endpoint='login_route')
def login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
            
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        
        # Simple authentication (in production, use proper auth with hashing)
        if username == 'admin' and password == 'admin':
            session['user'] = username
            session['authenticated'] = True
            return jsonify({
                'success': True,
                'message': 'Login successful',
                'user': username
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Invalid credentials'
            }), 401
    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({'success': False, 'message': 'Server error during login'}), 500

@app.route('/api/check-auth')
def check_auth():
    try:
        if session.get('authenticated'):
            return jsonify({'authenticated': True, 'user': session.get('user')})
        return jsonify({'authenticated': False})
    except Exception as e:
        print(f"Auth check error: {str(e)}")
        return jsonify({'authenticated': False})

@app.route('/api/logout')
def logout():
    try:
        session.clear()
        return jsonify({'success': True, 'message': 'Logout successful'})
    except Exception as e:
        print(f"Logout error: {str(e)}")
        return jsonify({'success': False, 'message': 'Logout failed'}), 500

# Dashboard routes
@app.route('/')
def index():
    try:
        if not session.get('authenticated'):
            return render_template('login.html')
        return render_template('index.html')
    except Exception as e:
        print(f"Index route error: {str(e)}")
        return "Error loading application", 500

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    data_status = {
        'baseline_forecast': not data_files['baseline_forecast'].empty,
        'test_results': not data_files['test_results'].empty,
        'model_performance': not data_files['model_performance'].empty,
        'scenario_data': not data_files['scenario_data'].empty
    }
    
    # Enhanced ML status with fallback information
    ml_status = {
        'scenario_engine_available': scenario_engine is not None,
        'forecast_engine_available': forecast_engine is not None,
        'scenario_models_loaded': len(scenario_engine.models) if scenario_engine else 0,
        'forecast_models_loaded': len(forecast_engine.models) if forecast_engine else 0,
        'forecast_fallback_models': len(forecast_engine.fallback_models) if forecast_engine else 0,
        'forecast_engine_operational': (forecast_engine and (
            getattr(forecast_engine, 'models_loaded', False) or 
            getattr(forecast_engine, 'fallback_models', False)
        )) if forecast_engine else False
    }
    
    return jsonify({
        'status': 'healthy',
        'message': 'ZRA Revenue Analytics API is running',
        'data_status': data_status,
        'ml_status': ml_status,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/dashboard/kpis')
def get_dashboard_kpis():
    """Get KPI data for dashboard overview"""
    try:
        baseline_data = data_files['baseline_forecast']
        test_data = data_files['test_results']
        
        if baseline_data.empty:
            return jsonify({'error': 'No baseline data available'}), 500
        
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
                    anomalies_count += len(deviation[deviation > 0.15])  # Increased threshold to 15%
        
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

@app.route('/api/dashboard/revenue-forecast')
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

# Revenue Forecasting Routes
@app.route('/api/forecast/generate', methods=['POST'])
def generate_forecast():
    """Generate annual revenue forecast using trained models"""
    try:
        if not forecast_engine:
            return jsonify({'error': 'Forecast engine not available'}), 500
        
        forecasts = forecast_engine.generate_annual_forecast()
        
        if not forecasts:
            return jsonify({'error': 'Failed to generate forecast. Models may not be loaded.'}), 500
        
        # Prepare data for frontend
        forecast_data = {
            'forecasts': forecasts,
            'summary': forecast_engine.get_forecast_summary(forecasts) if hasattr(forecast_engine, 'get_forecast_summary') else [],
            'generated_at': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S'),
            'models_used': {
                'ml_models': list(forecast_engine.models.keys()) if hasattr(forecast_engine, 'models') else [],
                'fallback_models': list(forecast_engine.fallback_models.keys()) if hasattr(forecast_engine, 'fallback_models') else []
            }
        }
        
        return jsonify(forecast_data)
        
    except Exception as e:
        print(f"Error generating forecast: {str(e)}")
        return jsonify({'error': 'Failed to generate forecast'}), 500

@app.route('/api/forecast/export', methods=['POST'])
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
            for tax_type, forecast_data in forecasts.items():
                row[tax_type.replace('_', ' ')] = forecast_data['values'][i]
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

@app.route('/api/forecast/model-status')
def get_forecast_model_status():
    """Get status of forecast ML models"""
    try:
        if not forecast_engine:
            return jsonify({
                'status': 'not_initialized',
                'message': 'Forecast engine not initialized',
                'models_available': 0,
                'fallback_models_available': 0
            })
        
        model_details = {}
        
        # Add ML models
        if hasattr(forecast_engine, 'models'):
            for model_name, model in forecast_engine.models.items():
                model_details[model_name] = {
                    'type': 'Prophet',
                    'status': 'loaded',
                    'method': 'ML Model'
                }
        
        # Add fallback models
        if hasattr(forecast_engine, 'fallback_models'):
            for model_name in forecast_engine.fallback_models.keys():
                if model_name not in model_details:
                    model_details[model_name] = {
                        'type': 'Pattern-based',
                        'status': 'fallback',
                        'method': 'Statistical Pattern'
                    }
        
        return jsonify({
            'status': 'operational',
            'models_available': len(forecast_engine.models) if hasattr(forecast_engine, 'models') else 0,
            'fallback_models_available': len(forecast_engine.fallback_models) if hasattr(forecast_engine, 'fallback_models') else 0,
            'models_loaded': getattr(forecast_engine, 'models_loaded', False),
            'total_tax_types': len(model_details),
            'model_details': model_details
        })
        
    except Exception as e:
        print(f"Error getting forecast model status: {str(e)}")
        return jsonify({'error': 'Failed to get forecast model status'}), 500

@app.route('/api/forecast/test')
def test_forecast():
    """Test endpoint to check forecast functionality"""
    try:
        if not forecast_engine:
            return jsonify({'error': 'Forecast engine not available'}), 500
        
        forecasts = forecast_engine.generate_annual_forecast()
        
        if forecasts and not isinstance(forecasts, dict) or 'error' not in forecasts:
            return jsonify({
                'success': True,
                'message': 'Forecast test successful',
                'tax_types_forecasted': list(forecasts.keys()),
                'sample_data': {
                    'dates': forecasts['Total_Revenue']['dates'][:3],
                    'values': [f"K{val:,.0f}" for val in forecasts['Total_Revenue']['values'][:3]]
                },
                'total_forecast': f"K{sum(forecasts['Total_Revenue']['values']):,.0f}"
            })
        else:
            error_msg = forecasts.get('error', 'No forecasts generated') if isinstance(forecasts, dict) else 'No forecasts generated'
            return jsonify({'error': error_msg}), 500
            
    except Exception as e:
        return jsonify({'error': f'Test failed: {str(e)}'}), 500

# Anomaly Detection Routes
@app.route('/api/anomalies/detections')
def get_anomalies():
    """Get anomaly detection data"""
    try:
        test_data = data_files['test_results']
        
        if test_data.empty:
            return jsonify({'error': 'No anomaly data available'}), 500
        
        # Calculate anomalies based on deviation between actual and predicted
        anomalies = []
        severity_counts = {'high': 0, 'medium': 0, 'low': 0}
        
        for _, row in test_data.iterrows():
            deviation_pct = abs(row['actual'] - row['predicted']) / row['actual'] * 100
            
            # Determine severity based on deviation percentage
            if deviation_pct > 20:
                severity = 'high'
                severity_counts['high'] += 1
            elif deviation_pct > 10:
                severity = 'medium'
                severity_counts['medium'] += 1
            else:
                severity = 'low'
                severity_counts['low'] += 1
            
            anomalies.append({
                'date': row['date'].strftime('%Y-%m-%d'),
                'region': 'National',  # Default since region not in data
                'tax_type': row['stream'],
                'severity': severity,
                'amount': f"K{row['actual']:,.0f}",
                'deviation': f"{deviation_pct:.1f}%",
                'actual_value': row['actual'],
                'predicted_value': row['predicted']
            })
        
        return jsonify({
            'anomalies': anomalies,
            'severity_counts': severity_counts
        })
        
    except Exception as e:
        print(f"Error getting anomalies: {str(e)}")
        return jsonify({'error': 'Failed to load anomaly data'}), 500

@app.route('/api/anomalies/flag', methods=['POST'])
def flag_anomaly():
    """Flag an anomaly for review"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
            
        date = data.get('date')
        tax_type = data.get('tax_type')
        
        # In a real implementation, this would save to a database
        print(f"🚩 Anomaly flagged: {tax_type} on {date}")
        
        return jsonify({
            'success': True,
            'message': f'Anomaly flagged for review: {tax_type} on {date}'
        })
        
    except Exception as e:
        print(f"Error flagging anomaly: {str(e)}")
        return jsonify({'error': 'Failed to flag anomaly'}), 500

# Scenario Planning Routes
@app.route('/api/scenario/run-simulation', methods=['POST'])
def run_scenario_simulation():
    """Run scenario simulation using trained ML models"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        vat_rate = float(data.get('vat_rate', 16))
        corporate_tax_rate = float(data.get('corporate_tax_rate', 35))
        income_tax_rate = float(data.get('income_tax_rate', 37.5))

        # Use ML models if available, otherwise fallback to CSV method
        if scenario_engine and scenario_engine.models:
            print("🧠 Using ML models for scenario simulation")
            result = scenario_engine.simulate_scenario_with_models(
                vat_rate, corporate_tax_rate, income_tax_rate
            )
            
            # Format the response
            scenario_results = {
                'revenue_change': {
                    'absolute': result['revenue_change'],
                    'percentage': result['impact_percentage'],
                    'formatted_absolute': f"K{result['revenue_change']:+,.0f}",
                    'formatted_percentage': f"{result['impact_percentage']:+.1f}%"
                },
                'chart_data': {
                    'dates': data_files['baseline_forecast']['date'].dt.strftime('%Y-%m-%d').tolist(),
                    'baseline': data_files['baseline_forecast']['Total_Revenue'].tolist(),
                    'scenario': generate_scenario_timeline(result, data_files['baseline_forecast']),
                    'differences': calculate_differences(result, data_files['baseline_forecast']),
                    'vat_baseline': data_files['baseline_forecast']['VAT'].tolist(),
                    'vat_scenario': generate_vat_scenario(result, data_files['baseline_forecast'])
                },
                'parameters_used': {
                    'vat_rate': vat_rate,
                    'corporate_tax_rate': corporate_tax_rate,
                    'income_tax_rate': income_tax_rate
                },
                'methodology': result.get('methodology', 'ML Model Prediction'),
                'models_used': result.get('models_used', [])
            }
        else:
            # Fallback to original CSV-based method
            print("⚠️ Using CSV fallback for scenario simulation")
            return run_scenario_simulation_fallback(vat_rate, corporate_tax_rate, income_tax_rate)

        return jsonify(scenario_results)

    except Exception as e:
        print(f"Error running ML scenario: {str(e)}")
        return jsonify({'error': 'Failed to run scenario simulation'}), 500

@app.route('/api/scenario/model-status')
def get_model_status():
    """Get status of ML models"""
    try:
        if not scenario_engine:
            return jsonify({
                'status': 'not_initialized',
                'message': 'Scenario engine not initialized',
                'models_available': 0
            })
        
        model_details = {}
        for model_name, model in scenario_engine.models.items():
            # Safe attribute access for both dictionary-like and object-like models
            model_type = "unknown"
            status = "unknown"
            elasticity = "N/A"
            
            if hasattr(model, 'type'):
                model_type = model.type
                status = 'loaded' if model.type != 'fallback' else 'fallback'
            elif hasattr(model, 'get') and callable(getattr(model, 'get')):
                model_type = model.get('type', 'unknown')
                status = 'loaded' if model.get('type') != 'fallback' else 'fallback'
            
            if hasattr(model, 'elasticity'):
                elasticity = model.elasticity
            elif hasattr(model, 'get') and callable(getattr(model, 'get')):
                elasticity = model.get('elasticity', 'N/A')
            
            model_details[model_name] = {
                'type': model_type,
                'status': status,
                'elasticity': elasticity
            }
        
        return jsonify({
            'status': 'initialized',
            'models_available': len(scenario_engine.models),
            'data_loaded': scenario_engine.data_loaded,
            'model_details': model_details
        })
        
    except Exception as e:
        print(f"Error getting model status: {str(e)}")
        return jsonify({'error': 'Failed to get model status'}), 500

@app.route('/api/dashboard/revenue-vs-forecast')
def get_revenue_vs_forecast():
    """Get revenue vs forecast comparison data from CSV"""
    try:
        # Load the all_forecast_results.csv file
        csv_path = os.path.join(app.config['DATA_FOLDER'], 'all_forecast_results.csv')
        
        if not os.path.exists(csv_path):
            return jsonify({'error': 'Forecast results data not available'}), 500
        
        data = pd.read_csv(csv_path)
        data['date'] = pd.to_datetime(data['date'])
        
        # Get the latest data for each tax type (or aggregate as needed)
        # For simplicity, let's use VAT data as an example
        vat_data = data[data['stream'] == 'VAT'].tail(24)  # Last 24 months
        
        chart_data = {
            'dates': vat_data['date'].dt.strftime('%Y-%m-%d').tolist(),
            'actual': vat_data['actual'].tolist(),
            'predicted': vat_data['predicted'].tolist()
        }
        
        return jsonify(chart_data)
        
    except Exception as e:
        print(f"Error loading revenue vs forecast data: {str(e)}")
        return jsonify({'error': 'Failed to load revenue vs forecast data'}), 500

# Helper methods for scenario simulation
def generate_scenario_timeline(result, baseline_data):
    """Generate scenario timeline based on ML prediction"""
    baseline_values = baseline_data['Total_Revenue'].tolist()
    impact_factor = result['revenue_change'] / baseline_values[-1] if baseline_values[-1] != 0 else 0
    
    # Apply the impact proportionally to the timeline
    scenario_timeline = []
    for i, baseline_val in enumerate(baseline_values):
        # Gradually apply impact (more impact in later periods)
        progression_factor = (i + 1) / len(baseline_values)
        scenario_val = baseline_val * (1 + impact_factor * progression_factor * 0.3)
        scenario_timeline.append(scenario_val)
    
    return scenario_timeline

def calculate_differences(result, baseline_data):
    """Calculate differences for chart display"""
    baseline_values = baseline_data['Total_Revenue'].tolist()
    scenario_timeline = generate_scenario_timeline(result, baseline_data)
    return [scenario - baseline for scenario, baseline in zip(scenario_timeline, baseline_values)]

def generate_vat_scenario(result, baseline_data):
    """Generate VAT scenario timeline"""
    baseline_vat = baseline_data['VAT'].tolist()
    vat_impact_factor = 0.6  # Assume 60% of total impact is from VAT
    
    vat_scenario = []
    for i, baseline_val in enumerate(baseline_vat):
        progression_factor = (i + 1) / len(baseline_vat)
        scenario_val = baseline_val * (1 + result['impact_percentage']/100 * vat_impact_factor * progression_factor * 0.4)
        vat_scenario.append(scenario_val)
    
    return vat_scenario

def run_scenario_simulation_fallback(vat_rate, corporate_tax_rate, income_tax_rate):
    """Fallback method using CSV data"""
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
            'differences': differences,
            'vat_baseline': baseline_data['VAT'].tolist(),
            'vat_scenario': scenario_data['VAT'].tolist()
        },
        'parameters_used': {
            'vat_rate': vat_rate,
            'corporate_tax_rate': corporate_tax_rate,
            'income_tax_rate': income_tax_rate
        },
        'methodology': 'CSV Data Comparison',
        'models_used': ['csv_fallback']
    }
    
    return scenario_results

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({'error': 'Method not allowed'}), 405

if __name__ == '__main__':
    print("🚀 Starting ZRA Revenue Analytics System...")
    print("📊 System initialized with the following data:")
    print(f"   - Baseline forecast: {len(data_files['baseline_forecast'])} records")
    print(f"   - Test results: {len(data_files['test_results'])} records")
    print(f"   - Model performance: {len(data_files['model_performance'])} models")
    print(f"   - Scenario data: {len(data_files['scenario_data'])} records")
    
    # Print ML model status
    if scenario_engine:
        print(f"🤖 Scenario ML Models loaded: {len(scenario_engine.models)}")
    else:
        print("❌ ML Scenario Engine: Not initialized")
        
    if forecast_engine:
        print(f"📈 Forecast Engine Status:")
        print(f"   - ML Models loaded: {len(forecast_engine.models) if hasattr(forecast_engine, 'models') else 0}")
        print(f"   - Fallback models: {len(forecast_engine.fallback_models) if hasattr(forecast_engine, 'fallback_models') else 0}")
        operational = (
            getattr(forecast_engine, 'models_loaded', False) or 
            (hasattr(forecast_engine, 'fallback_models') and bool(forecast_engine.fallback_models))
        )
        print(f"   - Operational: {operational}")
        
        # Show which models are available
        if hasattr(forecast_engine, 'models') and forecast_engine.models:
            print("   ✅ ML Models:")
            for model_name in forecast_engine.models.keys():
                print(f"      - {model_name}")
        
        if hasattr(forecast_engine, 'fallback_models') and forecast_engine.fallback_models:
            print("   🔄 Fallback Models:")
            for model_name in forecast_engine.fallback_models.keys():
                print(f"      - {model_name}")
    else:
        print("❌ Forecast Engine: Not initialized")
    
    print("🌐 Server starting on http://localhost:5000")
    print("🔐 Default credentials: admin / admin")
    print("💡 Test forecasting at: http://localhost:5000/api/forecast/test")
    
    # PRODUCTION SETTINGS
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)



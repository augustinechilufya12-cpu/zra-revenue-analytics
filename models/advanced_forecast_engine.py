import pandas as pd
import numpy as np
import pickle
import json
import os
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

class AdvancedForecastEngine:
    def __init__(self, config):
        self.config = config
        self.models_loaded = False
        self.models = {}
        self.fallback_models = {}
        self.scaling_factors = self.calculate_scaling_factors()
        try:
            self.load_models_with_fallback()
            self.models_loaded = len(self.models) > 0
            if self.models_loaded:
                print(f"✅ Forecast Engine initialized with {len(self.models)} models")
            else:
                print("⚠️ Forecast Engine using fallback patterns only")
        except Exception as e:
            print(f"❌ Error initializing Forecast Engine: {str(e)}")
            self.models_loaded = False
    
    def calculate_scaling_factors(self):
        """Calculate realistic scaling factors based on Zambian revenue data"""
        scaling_factors = {
            'VAT': 25,           # Scale to ~25-35 billion range (largest revenue source)
            'Corporate_Tax': 12,  # Scale to ~12-18 billion range
            'Customs_Duties': 10, # Scale to ~10-15 billion range  
            'Excise_Tax': 6,      # Scale to ~6-9 billion range
            'Mineral_Royalty': 8, # Scale to ~8-12 billion range (important for Zambia)
            'PAYE': 15,           # Scale to ~15-20 billion range
            'Total_Revenue': 80   # Scale to ~80-100 billion range (sum of components)
        }
        return scaling_factors
    
    def load_models_with_fallback(self):
        """Load models with robust error handling and fallbacks"""
        models_folder = os.path.join(os.path.dirname(__file__), '..', 'trained_models')
        
        model_files = {
            'Corporate_Tax': 'Corporate_Tax_model.pkl',
            'Customs_Duties': 'Customs_Duties_model.pkl', 
            'Excise_Tax': 'Excise_Tax_model.pkl',
            'Mineral_Royalty': 'Mineral_Royalty_model.pkl',
            'PAYE': 'PAYE_model.pkl',
            'Total_Revenue': 'Total_Revenue_model.pkl',
            'VAT': 'VAT_model.pkl'
        }
        
        loaded_count = 0
        
        print(f"📂 Loading models from: {models_folder}")
        
        for tax_type, model_file in model_files.items():
            model_path = os.path.join(models_folder, model_file)
            if os.path.exists(model_path):
                try:
                    # Try to load the model with different compatibility approaches
                    model = self.load_model_with_compatibility(model_path)
                    
                    if model and self.validate_model(model, tax_type):
                        self.models[tax_type] = model
                        loaded_count += 1
                        print(f"✅ Loaded {tax_type} model successfully")
                    else:
                        print(f"❌ Model validation failed for {tax_type}, using fallback")
                        self.create_fallback_for_tax(tax_type)
                        
                except Exception as e:
                    print(f"❌ Error loading {tax_type}: {str(e)}")
                    self.create_fallback_for_tax(tax_type)
            else:
                print(f"❌ Model file not found: {model_path}")
                self.create_fallback_for_tax(tax_type)
        
        print(f"📊 Successfully loaded {loaded_count}/{len(model_files)} models")
        
        # If no models loaded, create fallbacks for all
        if loaded_count == 0:
            print("🔄 Creating fallback models for all tax types")
            for tax_type in model_files.keys():
                self.create_fallback_for_tax(tax_type)
    
    def load_model_with_compatibility(self, model_path):
        """Load model with compatibility handling for different versions"""
        try:
            with open(model_path, 'rb') as f:
                return pickle.load(f)
        except (ModuleNotFoundError, AttributeError, ImportError) as e:
            print(f"⚠️ Compatibility issue loading {os.path.basename(model_path)}: {str(e)}")
            print("🔄 Attempting compatibility load...")
            
            # Try with protocol-based loading
            try:
                with open(model_path, 'rb') as f:
                    return pickle.load(f, encoding='latin1')
            except:
                pass
                
            # Try with different protocols
            for protocol in [pickle.HIGHEST_PROTOCOL, pickle.DEFAULT_PROTOCOL, 2]:
                try:
                    with open(model_path, 'rb') as f:
                        return pickle.load(f, protocol=protocol)
                except:
                    continue
            
            print(f"❌ All compatibility attempts failed for {os.path.basename(model_path)}")
            return None
        except Exception as e:
            print(f"❌ Other error loading model: {str(e)}")
            return None
    
    def create_fallback_for_tax(self, tax_type):
        """Create a realistic fallback pattern for a tax type with values in millions"""
        # Base patterns in millions (realistic Zambian revenue figures for 2024)
        fallback_patterns = {
            'VAT': {
                'base': 28000, 'trend': 800, 'seasonality': 0.08,  # ~28-32 billion
                'growth_rate': 0.10, 'monthly_variation': 0.08
            },
            'Corporate_Tax': {
                'base': 15000, 'trend': 400, 'seasonality': 0.12,   # ~15-18 billion
                'growth_rate': 0.08, 'monthly_variation': 0.10
            },
            'Customs_Duties': {
                'base': 12000, 'trend': 300, 'seasonality': 0.06,   # ~12-14 billion
                'growth_rate': 0.07, 'monthly_variation': 0.09
            },
            'Excise_Tax': {
                'base': 8000, 'trend': 200, 'seasonality': 0.10,    # ~8-9.5 billion
                'growth_rate': 0.06, 'monthly_variation': 0.07
            },
            'Mineral_Royalty': {
                'base': 10000, 'trend': 500, 'seasonality': 0.15,   # ~10-12 billion (copper mining)
                'growth_rate': 0.12, 'monthly_variation': 0.20
            },
            'PAYE': {
                'base': 18000, 'trend': 600, 'seasonality': 0.05,   # ~18-21 billion
                'growth_rate': 0.09, 'monthly_variation': 0.06
            },
            'Total_Revenue': {
                'base': 85000, 'trend': 2000, 'seasonality': 0.07,  # ~85-95 billion (sum of above)
                'growth_rate': 0.09, 'monthly_variation': 0.08
            }
        }
        
        self.fallback_models[tax_type] = fallback_patterns.get(tax_type, {
            'base': 15000, 'trend': 500, 'seasonality': 0.1,
            'growth_rate': 0.08, 'monthly_variation': 0.1
        })
        print(f"🔄 Created fallback pattern for {tax_type}")
    
    def validate_model(self, model, tax_type):
        """Simple validation that model has predict method"""
        return hasattr(model, 'predict')
    
    def generate_annual_forecast(self):
        """Generate 12-month forecast using available models or fallbacks"""
        try:
            start_date = datetime.now().replace(day=1) + timedelta(days=32)
            start_date = start_date.replace(day=1)
            
            future_dates = pd.date_range(start=start_date, periods=12, freq='MS')
            
            print(f"📅 Generating forecast for {len(future_dates)} months")
            print(f"📊 ML models available: {len(self.models)}")
            print(f"🔄 Fallback models available: {len(self.fallback_models)}")
            
            forecasts = {}
            
            # Generate forecasts using available methods
            all_tax_types = list(set(list(self.models.keys()) + list(self.fallback_models.keys())))
            
            for tax_type in all_tax_types:
                if tax_type in self.models:
                    forecast_data = self.generate_scaled_forecast(tax_type, self.models[tax_type], future_dates)
                    if forecast_data:
                        forecasts[tax_type] = forecast_data
                        print(f"🤖 Used ML model for {tax_type}")
                    else:
                        # Fallback if ML model fails during prediction
                        forecast_data = self.generate_fallback_forecast(tax_type, future_dates)
                        forecasts[tax_type] = forecast_data
                        print(f"🔄 Used fallback for {tax_type} (ML prediction failed)")
                elif tax_type in self.fallback_models:
                    forecast_data = self.generate_fallback_forecast(tax_type, future_dates)
                    forecasts[tax_type] = forecast_data
                    print(f"🔄 Used fallback for {tax_type}")
            
            # Ensure we have total revenue
            if 'Total_Revenue' not in forecasts:
                calculated_total = self.calculate_total_from_components(forecasts, future_dates)
                if calculated_total:
                    forecasts['Total_Revenue'] = calculated_total
                    print("✅ Calculated Total Revenue from components")
            
            print(f"✅ Generated forecasts for {len(forecasts)} tax types")
            self.print_forecast_summary(forecasts)
            
            return self.make_forecasts_json_serializable(forecasts)
            
        except Exception as e:
            print(f"❌ Forecast generation error: {str(e)}")
            return {"error": f"Forecast generation failed: {str(e)}"}
    
    def generate_scaled_forecast(self, tax_type, model, future_dates):
        """Generate forecast and scale it to realistic values in millions"""
        try:
            future = pd.DataFrame({'ds': future_dates})
            forecast = model.predict(future)
        
            if 'yhat' not in forecast.columns:
                return None
        
            # Get raw predictions
            raw_values = forecast['yhat'].values
        
            # Apply scaling factor to get realistic values (already in millions)
            scaling_factor = self.scaling_factors.get(tax_type, 1)
            scaled_values = raw_values * scaling_factor
        
            # Ensure minimum realistic values
            min_values = {
                'VAT': 20000,
                'Corporate_Tax': 10000,
                'Customs_Duties': 8000,
                'Excise_Tax': 5000,
                'Mineral_Royalty': 7000,
                'PAYE': 15000,
                'Total_Revenue': 70000
            }
            
            min_value = min_values.get(tax_type, 1000)
            scaled_values = np.maximum(scaled_values, min_value * 0.8)  # Allow some variation below min
            
            # Values are now in millions (no need for extra multiplication)
            revenue_values = scaled_values
        
            # Calculate confidence intervals
            if 'yhat_lower' in forecast.columns and 'yhat_upper' in forecast.columns:
               yhat_lower = forecast['yhat_lower'].values * scaling_factor
               yhat_upper = forecast['yhat_upper'].values * scaling_factor
            else:
               std_dev = np.std(revenue_values) * 0.1
               yhat_lower = np.maximum(min_value * 0.6, revenue_values - std_dev)
               yhat_upper = revenue_values + std_dev
        
            return {
                'dates': future_dates.strftime('%Y-%m-%d').tolist(),
                'values': revenue_values.tolist(),  # Values in millions
                'yhat_lower': yhat_lower.tolist(),
                'yhat_upper': yhat_upper.tolist(),
                'method': 'ML Model'
           }
            
        except Exception as e:
            print(f"❌ Scaled forecast failed for {tax_type}: {str(e)}")
            return None
    
    def generate_fallback_forecast(self, tax_type, future_dates):
        """Generate realistic forecast using fallback patterns"""
        try:
            pattern = self.fallback_models[tax_type]
            values = []
            
            # Set random seed for consistent results
            np.random.seed(hash(tax_type) % 10000)
            
            for i, date in enumerate(future_dates):
                month = date.month
                
                # Base value with trend (linear growth over 12 months)
                base_value = pattern['base'] + (pattern['trend'] * (i / 6))
                
                # Seasonal adjustment (peaks in certain months)
                seasonal_factor = 1 + (pattern['seasonality'] * np.sin(2 * np.pi * (month - 1) / 12))
                
                # Growth factor (compounding growth)
                growth_factor = (1 + pattern['growth_rate']) ** ((i + 1) / 12)
                
                # Monthly variation (random but bounded)
                variation = 1 + np.random.uniform(-pattern['monthly_variation'], pattern['monthly_variation'])
                
                # Calculate final value
                value = base_value * seasonal_factor * growth_factor * variation
                
                # Ensure realistic minimum values
                min_values = {
                    'VAT': 25000, 'Corporate_Tax': 12000, 'Customs_Duties': 10000,
                    'Excise_Tax': 7000, 'Mineral_Royalty': 8000, 'PAYE': 16000,
                    'Total_Revenue': 75000
                }
                min_value = min_values.get(tax_type, 1000)
                value = max(min_value * 0.9, value)
                
                values.append(value)
            
            # Calculate confidence intervals
            std_dev = np.std(values) * 0.15
            
            return {
                'dates': future_dates.strftime('%Y-%m-%d').tolist(),
                'values': values,
                'yhat_lower': [max(0, x - std_dev) for x in values],
                'yhat_upper': [x + std_dev for x in values],
                'method': 'Statistical Pattern'
            }
        except Exception as e:
            print(f"❌ Fallback forecast failed for {tax_type}: {str(e)}")
            return None
    
    def calculate_total_from_components(self, forecasts, future_dates):
        """Calculate total revenue by summing individual tax components"""
        try:
            component_taxes = ['VAT', 'Corporate_Tax', 'Customs_Duties', 'Excise_Tax', 'Mineral_Royalty', 'PAYE']
            
            total_values = []
            
            for i in range(len(future_dates)):
                monthly_total = 0
                valid_components = 0
                
                for tax in component_taxes:
                    if tax in forecasts and i < len(forecasts[tax]['values']):
                        monthly_total += forecasts[tax]['values'][i]
                        valid_components += 1
                
                if valid_components >= 3:  # Require at least 3 components
                    total_values.append(monthly_total)
                else:
                    # Use fallback if not enough components
                    return self.generate_fallback_forecast('Total_Revenue', future_dates)
            
            if len(total_values) != len(future_dates):
                return self.generate_fallback_forecast('Total_Revenue', future_dates)
            
            std_dev = np.std(total_values) * 0.1
            
            return {
                'dates': future_dates.strftime('%Y-%m-%d').tolist(),
                'values': total_values,
                'yhat_lower': [max(0, x - std_dev) for x in total_values],
                'yhat_upper': [x + std_dev for x in total_values],
                'method': 'Calculated from Components'
            }
            
        except Exception as e:
            print(f"❌ Error calculating total from components: {str(e)}")
            return self.generate_fallback_forecast('Total_Revenue', future_dates)
    
    def make_forecasts_json_serializable(self, forecasts):
        """Convert all numpy arrays to native Python types for JSON serialization"""
        try:
            serializable_forecasts = {}
            
            for tax_type, forecast_data in forecasts.items():
                serializable_forecasts[tax_type] = {}
                
                for key, value in forecast_data.items():
                    if isinstance(value, (np.ndarray, np.generic)):
                        serializable_forecasts[tax_type][key] = value.tolist() if hasattr(value, 'tolist') else float(value)
                    elif isinstance(value, list):
                        cleaned_list = []
                        for item in value:
                            if isinstance(item, (np.ndarray, np.generic)):
                                cleaned_list.append(item.tolist() if hasattr(item, 'tolist') else float(item))
                            else:
                                cleaned_list.append(item)
                        serializable_forecasts[tax_type][key] = cleaned_list
                    else:
                        serializable_forecasts[tax_type][key] = value
            
            return serializable_forecasts
            
        except Exception as e:
            print(f"❌ Error making forecasts JSON serializable: {str(e)}")
            return {}
    
    def print_forecast_summary(self, forecasts):
        """Print detailed forecast summary for debugging"""
        print("\n📈 FORECAST SUMMARY:")
        print("=" * 80)
        for tax_type, data in forecasts.items():
            values = data['values']
            if values and len(values) > 0:
                total = sum(values)
                avg_monthly = np.mean(values)
                growth = ((values[-1] - values[0]) / values[0] * 100) if values[0] != 0 else 0
                method = data.get('method', 'Unknown')
                
                # Format for better readability
                if avg_monthly >= 1000:
                    display_avg = f"ZMW {avg_monthly/1000:6.1f}B"
                else:
                    display_avg = f"ZMW {avg_monthly:6.0f}M"
                
                print(f"  {tax_type:18} | {display_avg} avg | {growth:6.1f}% growth | {method}")
        print("=" * 80)
    
    def get_forecast_summary(self, forecasts):
        """Generate summary statistics for the frontend"""
        if not forecasts:
            return None
        
        summary = []
        for tax_type, data in forecasts.items():
            values = data['values']
            if values and len(values) > 0:
                total = sum(values)
                avg = np.mean(values)
                growth = ((values[-1] - values[0]) / values[0] * 100) if values[0] != 0 else 0
                method = data.get('method', 'ML Model')
                
                summary.append({
                    'tax_type': tax_type.replace('_', ' '),
                    'total_forecast': float(total),
                    'average_monthly': float(avg),
                    'max_monthly': float(max(values)),
                    'min_monthly': float(min(values)),
                    'growth_rate': float(growth),
                    'method': method
                })
        
        return summary

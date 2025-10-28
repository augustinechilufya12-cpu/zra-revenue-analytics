import pandas as pd
import numpy as np
import os
from datetime import datetime

class RevenueAnalyzer:
    def __init__(self, config):
        self.config = config
        self.data_loaded = False
        self.load_data()
    
    def load_data(self):
        """Load revenue analysis data"""
        try:
            baseline_path = os.path.join(self.config['DATA_FOLDER'], 'revpredict_baseline_forecast.csv')
            performance_path = os.path.join(self.config['DATA_FOLDER'], 'revpredict_model_performance.csv')
            
            self.baseline_data = pd.read_csv(baseline_path)
            self.baseline_data['date'] = pd.to_datetime(self.baseline_data['date'])
            
            self.performance_data = pd.read_csv(performance_path)
            
            self.data_loaded = True
            print("✅ Revenue analyzer data loaded successfully")
            
        except Exception as e:
            print(f"❌ Error loading revenue analysis data: {str(e)}")
            self.data_loaded = False
    
    def get_revenue_trends(self):
        """Analyze revenue trends"""
        if not self.data_loaded:
            return None
        
        trends = {}
        tax_types = ['VAT', 'Income_Tax', 'Customs_Duties', 'Excise_Tax', 'Total_Revenue']
        
        for tax_type in tax_types:
            if tax_type in self.baseline_data.columns:
                values = self.baseline_data[tax_type]
                growth_rates = values.pct_change() * 100
                
                trends[tax_type] = {
                    'current_value': values.iloc[-1],
                    'growth_rate': growth_rates.iloc[-1] if not pd.isna(growth_rates.iloc[-1]) else 0,
                    'volatility': growth_rates.std(),
                    'total_growth': ((values.iloc[-1] - values.iloc[0]) / values.iloc[0]) * 100
                }
        
        return trends
    
    def get_performance_metrics(self):
        """Get model performance metrics"""
        if not self.data_loaded:
            return None
        
        return self.performance_data.to_dict('records')
    
    def get_seasonal_patterns(self):
        """Analyze seasonal patterns in revenue"""
        if not self.data_loaded:
            return None
        
        self.baseline_data['month'] = self.baseline_data['date'].dt.month
        self.baseline_data['year'] = self.baseline_data['date'].dt.year
        
        seasonal_data = {}
        tax_types = ['VAT', 'Income_Tax', 'Customs_Duties', 'Excise_Tax']
        
        for tax_type in tax_types:
            monthly_avg = self.baseline_data.groupby('month')[tax_type].mean()
            seasonal_data[tax_type] = {
                'months': monthly_avg.index.tolist(),
                'values': monthly_avg.values.tolist(),
                'peak_month': monthly_avg.idxmax(),
                'trough_month': monthly_avg.idxmin()
            }
        
        return seasonal_data
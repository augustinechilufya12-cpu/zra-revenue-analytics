import os

class Config:
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    DATA_FOLDER = os.path.join(BASE_DIR, 'data')
    MODELS_FOLDER = os.path.join(BASE_DIR, 'trained_models')
    
    # Model files
    MODEL_FILES = {
        'vat': 'vat_prophet_model.pkl',
        'customs': 'customs_prophet_model.pkl',
        'excise': 'excise_prophet_model.pkl',
        'income_tax': 'income_tax_xgb_model.json'
    }

config = Config()
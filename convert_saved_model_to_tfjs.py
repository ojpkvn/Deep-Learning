import numpy as np
for n,t in (("object",object),("bool",bool),("int",int),("float",float),("complex",complex),("str",str)):
    if not hasattr(np,n): setattr(np,n,t)
import sys, types
sys.modules['tensorflow_hub']=types.ModuleType('tensorflow_hub')  # not needed for plain SavedModels
from tensorflowjs.converters import converter
sys.argv=["tensorflowjs_converter","--input_format=tf_saved_model","--output_format=tfjs_graph_model","--signature_name=serving_default","--saved_model_tags=serve","saved_model","tfjs_model"]
converter.pip_main()

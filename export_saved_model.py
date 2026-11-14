# Step 1 of the conversion: Keras (.keras) -> TensorFlow SavedModel (float32).
# Run in the same Python environment as your notebook (TensorFlow 2.19 / Keras 3).
#
# The notebook trains with mixed precision (mixed_float16). TensorFlow.js runs in float32,
# so we rebuild the model in float32 and copy the weights across layer by layer.
# Normalization layers need finalize_state() after the copy, otherwise their mean/variance
# stay at 0/1 and the predictions are wrong.
import json, keras

model = keras.models.load_model("model1_unfreeze_top.keras", compile=False)
keras.mixed_precision.set_global_policy("float32")
cfg = json.dumps(model.get_config()).replace("mixed_float16", "float32")
m32 = keras.Model.from_config(json.loads(cfg))

def copy_weights(src, dst):
    for l1 in src.layers:
        l2 = dst.get_layer(l1.name)
        if hasattr(l1, "layers") and l1.layers:
            copy_weights(l1, l2)
        else:
            for w1, w2 in zip(l1.weights, l2.weights):
                w2.assign(w1.numpy())

copy_weights(model, m32)
for l in m32.get_layer("efficientnetb0").layers:
    if type(l).__name__ == "Normalization":
        l.finalize_state()

m32.export("saved_model")
print("exported to ./saved_model")

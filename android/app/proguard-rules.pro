# React Native + Hermes keep rules are provided by the RN gradle plugin.
# Keep our native module so reflection-based bridge registration works.
-keep class com.aiassistant.overlay.** { *; }

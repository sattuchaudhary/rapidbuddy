import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Predefined gradient sets
export const GRADIENT_PURPLE = ['#667eea', '#764ba2'];
export const GRADIENT_ORANGE = ['#f59e0b', '#fbbf24'];
export const GRADIENT_BLUE = ['#3b82f6', '#60a5fa'];
export const GRADIENT_GREEN = ['#10b981', '#34d399'];
export const GRADIENT_RED = ['#ef4444', '#f87171'];

const StatCard = ({
  title,
  value,
  icon,
  gradientColors,
  onPress,
  loading = false,
  size = 'medium',
}) => {
  const displayValue = loading ? '---' : String(value ?? '');

  const cardHeight = size === 'small' ? 80 : size === 'large' ? 120 : 100;
  const iconSize = size === 'small' ? 28 : size === 'large' ? 48 : 40;
  const valueFontSize = size === 'small' ? 24 : size === 'large' ? 40 : 32;
  const titleFontSize = size === 'small' ? 12 : size === 'large' ? 16 : 14;

  const shadowColor = gradientColors[0] + '4D'; // 0.3 opacity

  const containerStyle = {
    height: cardHeight,
    borderRadius: 16,
    padding: 16,
    elevation: 4,
    shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    opacity: loading ? 0.7 : 1,
    margin: 8,
    flex: 1,
  };

  const content = (
    <LinearGradient colors={gradientColors} style={containerStyle}>
      {/* Gradient overlay for depth */}
      <View style={styles.overlay} />
      
      {/* Icon positioned absolutely top-right */}
      <View style={[styles.iconContainer, { width: iconSize, height: iconSize, top: 16, right: 16 }]}>
        {typeof icon === 'string' ? (
          <Text style={[styles.icon, { fontSize: iconSize }]}>{icon}</Text>
        ) : (
          icon
        )}
      </View>
      
      {/* Text content on left */}
      <View style={styles.textContainer}>
        <Text style={[styles.value, { fontSize: valueFontSize }]}>{displayValue}</Text>
        <Text style={[styles.title, { fontSize: titleFontSize }]}>{title}</Text>
      </View>
    </LinearGradient>
  );

  const accessibilityLabel = `${title}: ${displayValue}`;
  const accessibilityRole = onPress ? 'button' : undefined;
  const accessibilityHint = onPress ? 'Tap to view details' : undefined;

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        accessibilityHint={accessibilityHint}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View accessibilityLabel={accessibilityLabel}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    borderRadius: 16,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  value: {
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  title: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  iconContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    opacity: 0.3,
  },
});

export default StatCard;
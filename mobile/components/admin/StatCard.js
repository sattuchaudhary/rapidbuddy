import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const StatCard = ({
  title,
  value,
  icon,
  gradientColors,
  onPress,
  loading = false,
  size = 'medium',
  layout = 'horizontal',
}) => {
  const displayValue = loading ? '---' : String(value ?? '');

  const cardHeight = size === 'small' ? 80 : size === 'large' ? 120 : 100;
  const iconSize = size === 'small' ? 32 : size === 'large' ? 48 : 40;
  const valueFontSize = size === 'small' ? 24 : size === 'large' ? 36 : 32;
  const titleFontSize = size === 'small' ? 12 : size === 'large' ? 16 : 14;

  const containerStyle = {
    height: cardHeight,
    borderRadius: 16,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    opacity: loading ? 0.7 : 1,
  };

  const content = (
    <LinearGradient colors={gradientColors} style={containerStyle}>
      {layout === 'horizontal' ? (
        <View style={styles.horizontalContainer}>
          <View style={styles.textContainer}>
            <Text style={[styles.value, { fontSize: valueFontSize }]}>{displayValue}</Text>
            <Text style={[styles.title, { fontSize: titleFontSize }]}>{title}</Text>
          </View>
          <View style={[styles.iconContainer, { width: iconSize, height: iconSize }]}>
            {typeof icon === 'string' ? (
              <Text style={[styles.icon, { fontSize: iconSize }]}>{icon}</Text>
            ) : (
              icon
            )}
          </View>
        </View>
      ) : (
        <View style={styles.verticalContainer}>
          <View style={[styles.iconContainer, { width: iconSize, height: iconSize }]}>
            {typeof icon === 'string' ? (
              <Text style={[styles.icon, { fontSize: iconSize }]}>{icon}</Text>
            ) : (
              icon
            )}
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.value, { fontSize: valueFontSize }]}>{displayValue}</Text>
            <Text style={[styles.title, { fontSize: titleFontSize }]}>{title}</Text>
          </View>
        </View>
      )}
    </LinearGradient>
  );

  const accessibilityLabel = `${title}: ${displayValue}`;
  const accessibilityRole = onPress ? 'button' : undefined;

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
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
  horizontalContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verticalContainer: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  value: {
    fontWeight: 'bold',
    color: 'white',
  },
  title: {
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    opacity: 0.8,
  },
});

export default StatCard;
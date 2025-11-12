import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  useColorScheme
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width } = Dimensions.get('window');

const ForceLogoutModal = ({ visible, message, onOK }) => {
  const isDark = useColorScheme() === 'dark';
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      rotateAnim.setValue(0);
      pulseAnim.setValue(1);

      // Start entrance animations
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 40,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      // Start pulsing animation for icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      rotateAnim.setValue(0);
      pulseAnim.setValue(1);
    }
  }, [visible]);

  const handleOK = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onOK();
    });
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-10deg', '0deg'],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleOK}
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: opacityAnim,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
          },
        ]}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [
                { scale: scaleAnim },
                { rotate: rotate }
              ],
            },
          ]}
        >
          <LinearGradient
            colors={isDark 
              ? ['#1e1b4b', '#312e81', '#1e293b'] 
              : ['#ffffff', '#f0f9ff', '#e0f2fe']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {/* Decorative Top Border */}
            <View style={[styles.topBorder, { backgroundColor: isDark ? '#dc2626' : '#ef4444' }]} />

            {/* Icon Container with Animation */}
            <Animated.View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: isDark ? '#dc2626' : '#fee2e2',
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <LinearGradient
                colors={isDark ? ['#ef4444', '#dc2626'] : ['#fee2e2', '#fecaca']}
                style={styles.iconGradient}
              >
                <Ionicons
                  name="log-out-outline"
                  size={56}
                  color={isDark ? '#ffffff' : '#dc2626'}
                />
              </LinearGradient>
            </Animated.View>

            {/* Title with Shadow Effect */}
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: isDark ? '#f1f5f9' : '#1e293b' }]}>
                Logged Out
              </Text>
              <View style={[styles.titleUnderline, { backgroundColor: isDark ? '#dc2626' : '#ef4444' }]} />
            </View>

            {/* Message */}
            <View style={styles.messageContainer}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={isDark ? '#94a3b8' : '#64748b'}
                style={styles.messageIcon}
              />
              <Text style={[styles.message, { color: isDark ? '#cbd5e1' : '#475569' }]}>
                {message || 'You have been logged out by administrator. Please login again.'}
              </Text>
            </View>

            {/* Decorative Divider */}
            <View style={styles.dividerContainer}>
              <View style={[styles.dividerLine, { backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />
              <View style={[styles.dividerDot, { backgroundColor: isDark ? '#dc2626' : '#ef4444' }]} />
              <View style={[styles.dividerLine, { backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />
            </View>

            {/* OK Button with Enhanced Design */}
            <TouchableOpacity
              onPress={handleOK}
              activeOpacity={0.9}
              style={styles.buttonContainer}
            >
              <LinearGradient
                colors={['#ef4444', '#dc2626', '#b91c1c']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.button}
              >
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Continue to Login</Text>
                  <View style={styles.buttonIconContainer}>
                    <Ionicons name="arrow-forward" size={22} color="#ffffff" />
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContainer: {
    width: width * 0.9,
    maxWidth: 420,
    borderRadius: 28,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
  },
  topBorder: {
    height: 4,
    width: '100%',
  },
  gradient: {
    padding: 36,
    alignItems: 'center',
    paddingTop: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    elevation: 8,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  titleUnderline: {
    width: 60,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 28,
    paddingHorizontal: 12,
    width: '100%',
  },
  messageIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'left',
    flex: 1,
    fontWeight: '500',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 28,
    paddingHorizontal: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 12,
  },
  buttonContainer: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  button: {
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginRight: 12,
  },
  buttonIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 6,
  },
});

export default ForceLogoutModal;


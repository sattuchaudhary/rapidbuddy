import React, { Component } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Updates from 'expo-updates';
import { logErrorBoundary, getErrorMessage } from '../utils/errorHandler.js';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logErrorBoundary(error, errorInfo, 'ErrorBoundary');
    this.setState({ errorInfo });
    console.error('Component stack:', errorInfo.componentStack);
    // Placeholder for future remote logging: sendErrorToService(error, errorInfo);
  }

  handleRestart = async () => {
    if (__DEV__) {
      console.warn('Restart not available in development mode. Resetting error state.');
      this.setState({ hasError: false, error: null, errorInfo: null });
    } else {
      try {
        await Updates.reloadAsync();
      } catch (err) {
        console.error('Failed to restart app:', err);
        this.setState({ hasError: false, error: null, errorInfo: null });
      }
    }
  };

  handleDismiss = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <LinearGradient
            colors={['#0b1220', '#0b2a6f', '#0b1220']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.iconContainer}>
              <Text style={{ fontSize: 64 }}>⚠️</Text>
            </View>
            <Text style={styles.title}>Oops! Something went wrong</Text>
            <Text style={styles.subtitle}>The app encountered an unexpected error</Text>
            <Text style={styles.errorMessage}>
              {getErrorMessage(this.state.error, 'An unexpected error occurred')}
            </Text>
            {__DEV__ && this.state.errorInfo && (
              <Text style={styles.stackTrace}>
                {this.state.errorInfo.componentStack}
              </Text>
            )}
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.primaryButton} onPress={this.handleRestart}>
                <Text style={styles.buttonText}>Restart App</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={this.handleDismiss}>
                <Text style={styles.buttonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#10121A',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorMessage: {
    fontSize: 14,
    color: '#FF6B6B',
    backgroundColor: 'rgba(255,107,107,0.1)',
    padding: 16,
    borderRadius: 8,
    marginBottom: 32,
    textAlign: 'center',
  },
  stackTrace: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    maxHeight: 200,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ErrorBoundary;
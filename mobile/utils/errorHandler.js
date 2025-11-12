// Error handling utilities for mobile app
// This module provides centralized error handling utilities used throughout the mobile app, including ErrorBoundary support
import { Alert } from 'react-native';

export const handleProgressError = (error, context = 'Progress') => {
  console.error(`${context} Error:`, error);
  
  // Return safe default progress
  return {
    processed: 0,
    total: 0,
    percentage: 0,
    error: error.message || 'Unknown error'
  };
};

export const safeProgressCallback = (callback, progressData) => {
  try {
    if (callback && typeof callback === 'function') {
      // Validate progress data
      const safeData = {
        processed: Math.max(0, parseInt(progressData?.processed) || 0),
        total: Math.max(1, parseInt(progressData?.total) || 1),
        percentage: Math.max(0, Math.min(100, parseFloat(progressData?.percentage) || 0))
      };
      
      callback(safeData);
    }
  } catch (error) {
    console.error('Progress callback error:', error);
  }
};

export const validateProgressData = (data) => {
  if (!data || typeof data !== 'object') {
    return { processed: 0, total: 0, percentage: 0 };
  }
  
  return {
    processed: Math.max(0, parseInt(data.processed) || 0),
    total: Math.max(1, parseInt(data.total) || 1),
    percentage: Math.max(0, Math.min(100, parseFloat(data.percentage) || 0))
  };
};

export const logProgress = (context, progressData) => {
  const safe = validateProgressData(progressData);
  console.log(`${context}: ${safe.processed}/${safe.total} (${safe.percentage}%)`);
};

// General error logging utility
export const logError = (error, context = 'Error', userMessage = '') => {
  try {
    const ts = new Date().toISOString();
    console.error(`[${ts}] ${context}:`, error && (error.stack || error.message || error));
    if (userMessage) console.info(`User message: ${userMessage}`);
  } catch (err) {
    console.error('logError failure:', err);
  }
};

/**
 * Logs errors specifically caught by the ErrorBoundary component.
 * This specialized logger provides detailed context for ErrorBoundary catches,
 * including component stack traces for better debugging.
 *
 * @param {Error} error - The error object caught by the ErrorBoundary.
 * @param {Object} errorInfo - React errorInfo object containing componentStack.
 * @param {string} [context='ErrorBoundary'] - Context string for the error log.
 *
 * @example
 * logErrorBoundary(error, errorInfo, 'LoginScreen ErrorBoundary');
 */
export const logErrorBoundary = (error, errorInfo, context = 'ErrorBoundary') => {
  try {
    const ts = new Date().toISOString();
    console.error(`[${ts}] ${context} - ErrorBoundary Catch:`, error && (error.stack || error.message || error));
    if (errorInfo && errorInfo.componentStack) {
      console.error(`[${ts}] ${context} - Component Stack:`, errorInfo.componentStack);
    }
  } catch (err) {
    console.error('logErrorBoundary failure:', err);
  }
};

/**
 * Classifies the severity of an error based on its message content.
 * This helps prioritize error handling and can be used for conditional restart logic.
 *
 * @param {Error} error - The error object to classify.
 * @returns {string} Severity level: 'critical', 'high', 'medium', or 'low'.
 *
 * @example
 * const severity = getErrorSeverity(error);
 * if (severity === 'critical') {  }
 */
export const getErrorSeverity = (error) => {
  if (!error || !error.message) return 'low';
  const msg = error.message.toLowerCase();
  if (msg.includes('network') || msg.includes('database') || msg.includes('auth') || msg.includes('token')) {
    return 'critical';
  }
  if (msg.includes('render') || msg.includes('state') || msg.includes('props')) {
    return 'high';
  }
  if (msg.includes('parse') || msg.includes('invalid') || msg.includes('validation')) {
    return 'medium';
  }
  return 'low';
};

/**
 * Provides user-friendly recovery suggestions based on the error type.
 * This can be displayed in the ErrorBoundary UI to guide users on next steps.
 *
 * @param {Error} error - The error object to analyze.
 * @returns {string} User-friendly recovery suggestion string.
 *
 * @example
 * const suggestion = getRecoverySuggestion(error);
 * // Display suggestion in UI: "Please check your internet connection and try again"
 */
export const getRecoverySuggestion = (error) => {
  if (!error || !error.message) return 'Please restart the app';
  const msg = error.message.toLowerCase();
  if (msg.includes('network')) {
    return 'Please check your internet connection and try again';
  }
  if (msg.includes('auth') || msg.includes('token')) {
    return 'Please log in again';
  }
  if (msg.includes('database') || msg.includes('parse') || msg.includes('invalid')) {
    return 'Please refresh the app';
  }
  return 'Please restart the app';
};

// Extract user-friendly error message from various error shapes (axios, native Error)
export const getErrorMessage = (error, defaultMessage = 'Something went wrong') => {
  try {
    if (!error) return defaultMessage;
    if (error.response && error.response.data && error.response.data.message) return String(error.response.data.message);
    if (error.message) return String(error.message);
    return String(error);
  } catch (err) {
    console.error('getErrorMessage failure:', err);
    return defaultMessage;
  }
};

// Show a consistent error alert to the user
export const showErrorAlert = (title = 'Error', message = 'An error occurred', onDismiss) => {
  try {
    Alert.alert(title, message, [{ text: 'OK', onPress: onDismiss }], { cancelable: true });
  } catch (err) {
    console.error('showErrorAlert failure:', err);
  }
};
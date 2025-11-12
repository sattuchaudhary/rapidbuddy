import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const VehicleUploadCard = ({ upload, onPress, onDelete, vehicleType }) => {
  const getVehicleIcon = () => {
    switch (vehicleType) {
      case 'TwoWheeler':
        return '🏍️';
      case 'FourWheeler':
        return '🚗';
      case 'Commercial':
        return '🚚';
      default:
        return '🚗';
    }
  };

  const StatusBadge = () => {
    const isOk = upload.status === 'ok';
    return (
      <View style={[styles.statusBadge, { backgroundColor: isOk ? '#10b981' : '#EF4444' }]}>
        <Ionicons name={isOk ? 'checkmark' : 'close'} size={10} color="#FFFFFF" />
      </View>
    );
  };

  const RecordsBadge = () => (
    <View style={styles.recordsBadge}>
      <Text style={styles.recordsBadgeText}>{upload.total}</Text>
    </View>
  );

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      accessibilityLabel={`${upload.bankName}, ${upload.fileName}, ${upload.total} records`}
      accessibilityHint="Tap to view vehicle details"
      accessibilityRole="button"
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.vehicleIcon}>{getVehicleIcon()}</Text>
        <Text style={styles.bankName}>{upload.bankName}</Text>
        <StatusBadge />
      </View>

      {/* File info row */}
      <View style={styles.fileInfoRow}>
        <Text style={styles.fileName}>{upload.fileName}</Text>
        <View style={styles.uploadDateContainer}>
          <Text style={styles.calendarIcon}>📅</Text>
          <Text style={styles.uploadDate}>{formatDate(upload.uploadDate)}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <RecordsBadge />
        <View style={styles.userContainer}>
          <Text style={styles.userIcon}>👤</Text>
          <Text style={styles.userName}>{upload.user}</Text>
        </View>
      </View>

      {/* Action buttons row */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={onPress}>
          <Ionicons name="eye-outline" size={18} color="#3B82F6" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onDelete}>
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 8,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  vehicleIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  bankName: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  statusBadge: {
    padding: 4,
    borderRadius: 12,
  },
  fileInfoRow: {
    marginBottom: 8,
  },
  fileName: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  uploadDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  uploadDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  recordsBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recordsBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  userName: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    marginLeft: 8,
    padding: 8,
  },
});

export default VehicleUploadCard;
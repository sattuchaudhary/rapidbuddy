import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const VehicleCard = ({
  vehicle,
  onPress,
  onDelete,
  showActions = true
}) => {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return '#FFA500';
      case 'hold':
        return '#F59E0B';
      case 'in yard':
        return '#3B82F6';
      case 'released':
        return '#10B981';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const statusColor = getStatusColor(vehicle?.status);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityLabel={`${vehicle?.regNo || 'Unknown'}, ${vehicle?.customerName || 'Unknown'}, ${vehicle?.status || 'Unknown status'}`}
      accessibilityHint="Tap to view full details"
      accessibilityRole="button"
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.regNoText} numberOfLines={1} ellipsizeMode="tail">
          {vehicle?.regNo || 'N/A'}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusBadgeText}>
            {vehicle?.status || 'Unknown'}
          </Text>
        </View>
      </View>

      {/* Info section */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Text style={styles.bankIcon}>🏦</Text>
          <Text style={styles.infoText}>{vehicle?.bank || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.documentIcon}>📄</Text>
          <Text style={styles.infoText}>{vehicle?.loanNo || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.userIcon}>👤</Text>
          <Text style={styles.customerNameText} numberOfLines={1} ellipsizeMode="tail">
            {vehicle?.customerName || 'N/A'}
          </Text>
        </View>
      </View>

      {/* Details section */}
      <View style={styles.detailsSection}>
        <View style={styles.makeBadge}>
          <Text style={styles.makeBadgeText}>{vehicle?.make || 'N/A'}</Text>
        </View>
        <Text style={styles.detailText} numberOfLines={1} ellipsizeMode="tail">
          Chassis: {vehicle?.chassisNo || 'N/A'}
        </Text>
        <Text style={styles.detailText} numberOfLines={1} ellipsizeMode="tail">
          Engine: {vehicle?.engineNo || 'N/A'}
        </Text>
      </View>

      {/* Action buttons row */}
      {showActions && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#dbeafe' }]}
            onPress={onPress}
            accessibilityLabel="View details"
            accessibilityRole="button"
          >
            <Ionicons name="eye-outline" size={18} color="#2563eb" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#fee2e2' }]}
            onPress={onDelete}
            accessibilityLabel="Delete vehicle"
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={18} color="#dc2626" />
          </TouchableOpacity>
        </View>
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  regNoText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4F46E5',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  infoSection: {
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bankIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  documentIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  userIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  customerNameText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
  detailsSection: {
    marginBottom: 8,
  },
  makeBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  makeBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
  },
  detailText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

export default VehicleCard;
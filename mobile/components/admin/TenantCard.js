import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';

const TenantCard = ({ tenant, onPress, onEdit, onDelete, onViewUsers }) => {
  const Badge = ({ text, color }) => (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );

  const getTypeColor = (type) => {
    const t = (type || 'agency').toLowerCase();
    switch (t) {
      case 'agency': return '#2196F3'; // blue
      case 'nbfc': return '#FF9800'; // orange
      case 'bank': return '#F44336'; // red
      default: return '#9E9E9E';
    }
  };

  const getPlanColor = (plan) => {
    const p = (plan || 'basic').toLowerCase();
    switch (p) {
      case 'basic': return '#9E9E9E'; // gray
      case 'premium': return '#9C27B0'; // purple
      case 'enterprise': return '#FFD700'; // gold
      default: return '#9E9E9E';
    }
  };

  const getStatusColor = (isActive) => {
    return isActive ? '#4CAF50' : '#9E9E9E'; // green or gray
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Tenant',
      `Are you sure you want to delete "${tenant.name}"? This action cannot be undone and will result in data loss.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(tenant._id) },
      ]
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const createdByName = tenant.createdBy ? `${tenant.createdBy.firstName} ${tenant.createdBy.lastName}` : 'Unknown';

  // normalize type and plan for display
  const typeKey = (tenant.type || 'agency').toLowerCase();
  const planKey = (tenant.subscription?.plan || 'basic').toLowerCase();

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      accessibilityLabel={`Tenant: ${tenant.name}, Status: ${tenant.isActive ? 'Active' : 'Inactive'}`}
      accessibilityHint="Tap to view tenant details"
    >
      <View style={styles.headerRow}>
        <Text style={styles.tenantName} numberOfLines={1} ellipsizeMode="tail">
          {tenant.name}
        </Text>
        <Badge text={tenant.isActive ? 'Active' : 'Inactive'} color={getStatusColor(tenant.isActive)} />
      </View>

      <View style={styles.infoRow}>
        <Badge text={tenant.type ? tenant.type.charAt(0).toUpperCase() + tenant.type.slice(1) : 'Agency'} color={getTypeColor(tenant.type)} />
        <Badge text={tenant.subscription?.plan ? tenant.subscription.plan.charAt(0).toUpperCase() + tenant.subscription.plan.slice(1) : 'Basic'} color={getPlanColor(tenant.subscription?.plan)} />
      </View>

      <View style={styles.detailsSection}>
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>📅</Text>
          <Text style={styles.detailText}>Created: {formatDate(tenant.createdAt)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>👤</Text>
          <Text style={styles.detailText}>By: {createdByName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>👥</Text>
          <Text style={styles.detailText}>
            Users: {tenant.subscription?.currentUsers || 0} / {tenant.subscription?.maxUsers || tenant.maxUsers || 10}
          </Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onEdit}
          accessibilityLabel="Edit tenant"
          accessibilityHint="Tap to edit tenant details"
        >
          <Text style={styles.actionIcon}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={handleDelete}
          accessibilityLabel="Delete tenant"
          accessibilityHint="Tap to delete this tenant"
        >
          <Text style={styles.actionIcon}>🗑️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onViewUsers}
          accessibilityLabel="View tenant users"
          accessibilityHint="Tap to view users in this tenant"
        >
          <Text style={styles.actionIcon}>👁️</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
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
  tenantName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
    marginRight: 8,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  detailsSection: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
  },
  actionIcon: {
    fontSize: 16,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default TenantCard;
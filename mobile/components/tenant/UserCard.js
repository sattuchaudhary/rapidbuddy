import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const UserCard = ({
  user,
  userType,
  onPress,
  onEdit,
  onDelete,
  onToggleStatus,
  showActions = true
}) => {
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (userType) => {
    switch (userType) {
      case 'staff':
        return '#3b82f6'; // Blue for staff
      case 'agent':
        return '#f59e0b'; // Orange for agents
      default:
        return '#6B7280';
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'Sub Admin':
        return '#8b5cf6'; // Purple
      case 'Manager':
        return '#3b82f6'; // Blue
      case 'Supervisor':
        return '#06b6d4'; // Cyan
      case 'Staff':
      default:
        return '#10b981'; // Green
    }
  };

  const getStatusBadgeColor = (status) => {
    return status === 'active' ? '#10b981' : '#6B7280';
  };

  const formatRole = (role) => {
    switch (role) {
      case 'Sub Admin':
        return 'Sub Admin';
      case 'Manager':
        return 'Manager';
      case 'Supervisor':
        return 'Supervisor';
      case 'Staff':
        return 'Staff';
      default:
        return role || 'Staff';
    }
  };

  const fullName = user?.name || 'Unknown User';
  const initials = getInitials(fullName);
  const avatarColor = getAvatarColor(userType);
  const roleBadgeColor = getRoleBadgeColor(user?.role);
  const statusBadgeColor = getStatusBadgeColor(user?.status);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityLabel={`${fullName}, ${userType === 'staff' ? formatRole(user?.role) : 'Agent'}, ${user?.status === 'active' ? 'Active' : 'Inactive'}`}
      accessibilityHint={onPress ? "Tap to view details" : undefined}
      accessibilityRole={onPress ? "button" : undefined}
    >
      {/* Left Section: Avatar */}
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      {/* Middle Section: Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.nameText} numberOfLines={1} ellipsizeMode="tail">
          {fullName}
        </Text>
        <Text style={styles.emailText} numberOfLines={1} ellipsizeMode="tail">
          {user?.email || 'No email'}
        </Text>
        <Text style={styles.phoneText} numberOfLines={1} ellipsizeMode="tail">
          {user?.phoneNumber || 'No phone'}
        </Text>
        <View style={styles.locationContainer}>
          <Text style={styles.locationIcon}>📍</Text>
          <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
            {user?.city && user?.state ? `${user.city}, ${user.state}` : 'No location'}
          </Text>
        </View>
        {userType === 'staff' && user?.role && (
          <View style={[styles.badge, { backgroundColor: roleBadgeColor }]}>
            <Text style={styles.badgeText}>{formatRole(user.role)}</Text>
          </View>
        )}
        {userType === 'agent' && user?.agentId && (
          <Text style={styles.agentIdText}>ID: {user.agentId}</Text>
        )}
      </View>

      {/* Right Section: Status Badge and Actions */}
      <View style={styles.rightContainer}>
        <View style={[styles.statusBadge, { backgroundColor: statusBadgeColor }]}>
          <Ionicons
            name={user?.status === 'active' ? 'checkmark' : 'close'}
            size={10}
            color="#FFFFFF"
          />
          <Text style={styles.statusBadgeText}>
            {user?.status === 'active' ? 'Active' : 'Inactive'}
          </Text>
        </View>
        {showActions && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#dbeafe' }]}
              onPress={onEdit}
              accessibilityLabel="Edit user"
              accessibilityRole="button"
            >
              <Ionicons name="pencil-outline" size={18} color="#2563eb" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#fee2e2' }]}
              onPress={onDelete}
              accessibilityLabel="Delete user"
              accessibilityRole="button"
            >
              <Ionicons name="trash-outline" size={18} color="#dc2626" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#f3f4f6' }]}
              onPress={onToggleStatus}
              accessibilityLabel={`Toggle status to ${user?.status === 'active' ? 'inactive' : 'active'}`}
              accessibilityRole="button"
            >
              <Ionicons
                name={user?.status === 'active' ? 'pause-outline' : 'play-outline'}
                size={18}
                color="#374151"
              />
            </TouchableOpacity>
          </View>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  infoContainer: {
    flex: 1,
  },
  nameText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  emailText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  phoneText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  agentIdText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
  rightContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
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

export default UserCard;
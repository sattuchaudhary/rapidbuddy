import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const UserCard = ({ user, onPress, showTenant = true }) => {
  const getInitials = (firstName, lastName) => {
    const first = firstName ? firstName.charAt(0).toUpperCase() : '';
    const last = lastName ? lastName.charAt(0).toUpperCase() : '';
    return first + last || '?';
  };

  const getAvatarColor = (role) => {
    switch (role) {
      case 'super_admin':
        return '#764ba2';
      case 'admin':
        return '#4F46E5';
      case 'user':
      default:
        return '#43e97b';
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'super_admin':
        return '#764ba2';
      case 'admin':
        return '#4F46E5';
      case 'user':
      default:
        return '#43e97b';
    }
  };

  const getStatusBadgeColor = (isActive) => {
    return isActive ? '#10B981' : '#6B7280';
  };

  const formatRole = (role) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      case 'user':
        return 'User';
      default:
        return role;
    }
  };

  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  const initials = getInitials(user.firstName, user.lastName);
  const avatarColor = getAvatarColor(user.role);
  const roleBadgeColor = getRoleBadgeColor(user.role);
  const statusBadgeColor = getStatusBadgeColor(user.isActive);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityLabel={`${fullName}, ${formatRole(user.role)}`}
      accessibilityRole={onPress ? "button" : undefined}
    >
      {/* Left Section: Avatar */}
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      {/* Middle Section: Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.nameText} numberOfLines={1}>
          {fullName || 'Unknown User'}
        </Text>
        <Text style={styles.emailText} numberOfLines={1}>
          {user.email || 'No email'}
        </Text>
        {showTenant && user.role !== 'super_admin' && user.tenantName && (
          <Text style={styles.tenantText} numberOfLines={1}>
            {user.tenantName}
          </Text>
        )}
      </View>

      {/* Right Section: Badges */}
      <View style={styles.badgesContainer}>
        <View style={[styles.badge, { backgroundColor: roleBadgeColor }]}>
          <Text style={styles.badgeText}>{formatRole(user.role)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: statusBadgeColor }]}>
          <Text style={styles.badgeText}>{user.isActive ? 'Active' : 'Inactive'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 6,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
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
    marginBottom: 2,
  },
  emailText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  tenantText: {
    fontSize: 13,
    color: '#6B7280',
  },
  badgesContainer: {
    alignItems: 'flex-end',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

export default UserCard;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../models/models.dart';
import 'dart:convert';

final authProvider = StateNotifierProvider<AuthNotifier, User?>((ref) {
  return AuthNotifier();
});

class AuthNotifier extends StateNotifier<User?> {
  AuthNotifier() : super(null) {
    _loadUser();
  }

  Future<void> _loadUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userJson = prefs.getString('user');
    if (userJson != null) {
      state = User.fromJson(jsonDecode(userJson));
    }
  }

  Future<void> login(String employeeId, String password) async {
    final data = await apiService.login(employeeId, password);
    state = User.fromJson(data['user']);
  }

  Future<void> logout() async {
    await apiService.logout();
    state = null;
  }
}

final attendanceHistoryProvider = FutureProvider<List<AttendanceRecord>>((ref) async {
  return await apiService.getHistory();
});

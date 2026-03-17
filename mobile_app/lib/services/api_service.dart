import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';
import 'dart:convert';

class ApiService {
  final Dio _dio = Dio(BaseOptions(
    // NOTE: For Android emulator, use 10.0.2.2 instead of localhost
    baseUrl: 'http://10.0.2.2:8000',
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
  ));

  Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token');
  }

  Future<void> _setAuthHeader() async {
    final token = await _getToken();
    if (token != null) {
      _dio.options.headers['Authorization'] = 'Bearer $token';
    }
  }

  Future<Map<String, dynamic>> login(String employeeId, String password) async {
    final response = await _dio.post(
      '/auth/login',
      data: {'username': employeeId, 'password': password},
      options: Options(contentType: Headers.formUrlEncodedContentType),
    );
    
    final data = response.data;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', data['access_token']);
    await prefs.setString('user', jsonEncode(data['user']));
    
    return data;
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('user');
  }

  Future<List<AttendanceRecord>> getHistory() async {
    await _setAuthHeader();
    final response = await _dio.get('/attendance/history');
    return (response.data as List)
        .map((json) => AttendanceRecord.fromJson(json))
        .toList();
  }

  Future<void> markAttendance({
    required double lat,
    required double lng,
    required String photoPath,
  }) async {
    await _setAuthHeader();
    
    FormData formData = FormData.fromMap({
      'latitude': lat.toString(),
      'longitude': lng.toString(),
      'device_info': 'Flutter App Android',
      'photo': await MultipartFile.fromFile(photoPath, filename: 'selfie.jpg'),
    });

    await _dio.post('/attendance/mark', data: formData);
  }
}

final apiService = ApiService();

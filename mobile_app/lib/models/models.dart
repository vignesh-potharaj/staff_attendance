class User {
  final int id;
  final String name;
  final String employeeId;
  final String role;

  User({
    required this.id,
    required this.name,
    required this.employeeId,
    required this.role,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      name: json['name'],
      employeeId: json['employee_id'],
      role: json['role'],
    );
  }
}

class AttendanceRecord {
  final int id;
  final String date;
  final String checkInTime;
  final String status;
  final String photoUrl;

  AttendanceRecord({
    required this.id,
    required this.date,
    required this.checkInTime,
    required this.status,
    required this.photoUrl,
  });

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    return AttendanceRecord(
      id: json['id'],
      date: json['date'],
      checkInTime: json['check_in_time'],
      status: json['status'],
      photoUrl: json['photo_url'] ?? '',
    );
  }
}

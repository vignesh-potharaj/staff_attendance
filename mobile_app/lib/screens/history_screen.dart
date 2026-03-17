import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/providers.dart';
import 'package:intl/intl.dart';

class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsyncValue = ref.watch(attendanceHistoryProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance History'),
        backgroundColor: Colors.blue,
        foregroundColor: Colors.white,
      ),
      body: historyAsyncValue.when(
        data: (records) {
          if (records.isEmpty) {
            return const Center(child: Text('No attendance records found.'));
          }
          return RefreshIndicator(
            onRefresh: () async {
              // ignore: unused_result
              ref.refresh(attendanceHistoryProvider);
            },
            child: ListView.builder(
              itemCount: records.length,
              itemBuilder: (context, index) {
                final record = records[index];
                final checkInDateTime = DateTime.parse(record.checkInTime);
                final formattedTime = DateFormat.jm().format(checkInDateTime);
                
                return Card(
                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: record.status == 'PRESENT' ? Colors.green.shade100 : Colors.amber.shade100,
                      child: Icon(
                        record.status == 'PRESENT' ? Icons.check_circle : Icons.schedule,
                        color: record.status == 'PRESENT' ? Colors.green : Colors.amber,
                      ),
                    ),
                    title: Text(record.date, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('Check-in: $formattedTime'),
                    trailing: record.photoUrl.isNotEmpty 
                        ? const Icon(Icons.image, color: Colors.grey)
                        : null,
                  ),
                );
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text('Error: $err')),
      ),
    );
  }
}

import json
import re
import sys
import openpyxl
from datetime import date, datetime

def parse_attendance_xlsx(excel_file, json_file):
    wb = openpyxl.load_workbook(excel_file)
    sheet = wb.active

    headers = [cell.value for cell in sheet[1]]
    team_members = [name for name in headers if name not in ("Week", "Date", "Reasons for Absence")]

    data = []
    attendance_count = {member: {"attended": 0, "total": 0} for member in team_members}

    for row in sheet.iter_rows(min_row=2, values_only=True):
        if not row[0]:
            continue
        row_dict = dict(zip(headers, row))

        raw_date = row_dict["Date"]
        if isinstance(raw_date, (datetime, date)):
            date_str = raw_date.strftime("%Y-%m-%d")
        else:
            date_str = str(raw_date).strip()

        week_num = int(row_dict["Week"])
        week_info = {
            "Week": week_num,
            "Date": date_str,
            "Absentees": [],
            "Reasons": {}
        }

        for member in team_members:
            status = str(row_dict[member]).strip().lower() if row_dict[member] else ""
            attendance_count[member]["total"] += 1
            if status == "present":
                attendance_count[member]["attended"] += 1
            elif status == "absent":
                week_info["Absentees"].append(member)

        reasons_text = str(row_dict.get("Reasons for Absence") or "").strip()
        if reasons_text:
            for entry in re.split(r"[;,]", reasons_text):
                match = re.match(r"\s*([\w\s\(\)]+?)\s*-\s*(.+)", entry.strip())
                if match:
                    name, reason = match.groups()
                    week_info["Reasons"][name.strip()] = reason.strip()

        data.append(week_info)

    attendance_summary = {
        member: round(rec["attended"] / rec["total"], 2) if rec["total"] else 0.0
        for member, rec in attendance_count.items()
    }

    output = {
        "WeeklyAttendance": data,
        "AttendanceSummary": attendance_summary
    }

    with open(json_file, "w", encoding="utf-8") as out:
        json.dump(output, out, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    # Usage: python3 attendance.py <input.xlsx> <output.json>
    in_path = sys.argv[1]
    out_path = sys.argv[2]
    parse_attendance_xlsx(in_path, out_path)
    print(f"Saved attendance data to {out_path}")

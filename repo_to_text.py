import os

# Tentukan ekstensi file yang ingin dimasukkan ke dalam teks
EXTENSIONS_TO_INCLUDE = ['.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.json']
# Tentukan folder yang ingin diabaikan (seperti node_modules atau venv)
FOLDERS_TO_IGNORE = ['node_modules', '.git', 'venv', '__pycache__', 'dist', 'build']

output_file = "seluruh_kode_proyek.txt"

with open(output_file, "w", encoding="utf-8") as outfile:
    for root, dirs, files in os.walk("."):
        # Abaikan folder yang tidak penting
        dirs[:] = [d for d in dirs if d not in FOLDERS_TO_IGNORE]
        
        for file in files:
            ext = os.path.splitext(file)[1]
            # Pastikan file ekstensi cocok, dan skrip tidak membaca dirinya sendiri / file output
            # Skip files we don't want to include (this script itself, the output file, and package lock)
            if ext in EXTENSIONS_TO_INCLUDE and file != os.path.basename(__file__) and file != output_file and file != 'package-lock.json':
                file_path = os.path.join(root, file)
                
                # Tulis penanda nama file agar AI tahu ini kode dari file mana
                outfile.write(f"\n\n{'='*50}\n")
                outfile.write(f"FILE: {file_path}\n")
                outfile.write(f"{'='*50}\n\n")
                
                try:
                    with open(file_path, "r", encoding="utf-8") as infile:
                        outfile.write(infile.read())
                except Exception as e:
                    outfile.write(f"[Gagal membaca file: {str(e)}]\n")

print(f"Selesai! Semua kode telah digabung ke file: {output_file}")
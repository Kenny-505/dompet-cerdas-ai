"""Run the DataPipeline from the correct working directory."""
import subprocess, sys, os

script_dir = r'd:\Capstone Dicoding CC26-PSU115\dompet-cerdas-ai\data-science'
os.chdir(script_dir)
print(f"Working dir: {os.getcwd()}")
print(f"Raw dir exists: {os.path.exists('synthetic_v2/raw')}")
print(f"Files: {os.listdir('synthetic_v2/raw') if os.path.exists('synthetic_v2/raw') else 'MISSING'}")

result = subprocess.run(
    [sys.executable, 'DompetCerdasAI_DataPipeline.py'],
    capture_output=True, text=True, timeout=300,
    cwd=script_dir
)
print("Exit code:", result.returncode)
print("STDOUT:", result.stdout[-3000:] if len(result.stdout) > 3000 else result.stdout)
if result.stderr:
    print("STDERR:", result.stderr[-2000:] if len(result.stderr) > 2000 else result.stderr)

# Verify output
data_dir = os.path.join(script_dir, 'data')
if os.path.exists(data_dir):
    print(f"\nGenerated files in data/:")
    for f in os.listdir(data_dir):
        size = os.path.getsize(os.path.join(data_dir, f))
        print(f"  {f:<40} {size/1024:>8.1f} KB")
else:
    print("ERROR: data/ directory not created!")
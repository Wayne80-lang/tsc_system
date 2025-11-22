(function() {
    document.addEventListener('DOMContentLoaded', function() {
        console.log("✅ UserRole Admin JS Loaded");
        
        const roleSelect = document.querySelector('select[name="role"]');
        if (!roleSelect) {
            console.warn("⚠️ Role select not found!");
            return;
        }
        
        // Get all fieldsets
        const fieldsets = document.querySelectorAll('fieldset');
        let hodFieldset = null;
        let directFieldset = null;
        let systemFieldset = null;
        
        // Find fieldsets by their content field names
        fieldsets.forEach(function(fs) {
            const fields = fs.querySelectorAll('input, select, textarea');
            const fieldNames = Array.from(fields).map(f => f.name);
            
            if (fieldNames.includes('directorate')) {
                directFieldset = fs;
            } else if (fieldNames.includes('system_assigned')) {
                systemFieldset = fs;
            } else if (fieldNames.includes('hod')) {
                hodFieldset = fs;
            }
        });

        function updateFieldVisibility() {
            const selectedRole = roleSelect.value;
            
            // Hide and collapse all first
            [hodFieldset, directFieldset, systemFieldset].forEach(fs => {
                if (fs) {
                    fs.style.display = 'none';
                    fs.classList.add('collapsed');
                }
            });
            
            // Show and expand only the relevant one
            if (selectedRole === 'hod' && directFieldset) {
                directFieldset.style.display = 'block';
                directFieldset.classList.remove('collapsed');
                console.log("✅ Showing HOD directorate fields");
            } else if (selectedRole === 'sys_admin' && systemFieldset) {
                systemFieldset.style.display = 'block';
                systemFieldset.classList.remove('collapsed');
                console.log("✅ Showing System Admin fields");
            } else if (selectedRole === 'staff' && hodFieldset) {
                hodFieldset.style.display = 'block';
                hodFieldset.classList.remove('collapsed');
                console.log("✅ Showing Staff Manager fields");
            }
        }

        // Attach listener and run on page load
        roleSelect.addEventListener('change', updateFieldVisibility);
        updateFieldVisibility();
        
        // Watch for programmatic changes
        const observer = new MutationObserver(() => updateFieldVisibility());
        observer.observe(roleSelect, { attributes: true });
    });
})();

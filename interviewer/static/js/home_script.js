// Animation for feature cards
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate');
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.feature-card').forEach(card => {
    observer.observe(card);
});

// Form submission
let resumeText = '';
document.getElementById('uploadForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    try {
        const uploadResponse = await fetch('/upload_resume', {
            method: 'POST',
            body: formData
        });
        if (uploadResponse.ok) {
            const data = await uploadResponse.json();
            resumeText = data.text;
            window.location.href = `/chatbot?name=${encodeURIComponent(formData.get('name'))}&questions=${encodeURIComponent(formData.get('num_questions'))}&job_role=${encodeURIComponent(formData.get('job_role'))}&resume=${encodeURIComponent(resumeText)}`;
        } else {
            alert('Error uploading resume');
        }
    } catch (error) {
        alert('Error: ' + error);
    }
});

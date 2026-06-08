# Organ
* Has a defined set of pipes
* Has technical properties such as tape width or hole diameter
* Plays punched tape
  * tape is drawn through a pneumatic system
  * holes in tape control airflow
  * airflow reaches selected pipes
  * those pipes produce a note

# Pipe
* Can play one musical note
* Part of Organ
* On Tape represented by one row

# Tape
* Represents a song to a specific barrel organ
* Inherently depends on Organ and Song to define itself
* Effectively a table
  * each row represents one pipe
    * extending a hole further along the row extends the duration the pipe is played
  * each column represents one time unit of the song
    * actual speed depends on cranking speed of the musician

# Hole
* Each hole in the tape represents one note being played by a pipe
* can be extended along the row to extend the note

# Song
* A specific sequence of sounds forming music
* Represented as Scores or Tape

# Scores
* Human-readable notation of music
* Widely used to compose songs
* Can be printed on paper and read by most musicians

# Note
* Specific perceivable frequency defined by a name
